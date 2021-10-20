import { User } from "../@types/express/entity/User";
import * as yup from "yup";
import { comparePasswords } from "../utils/passwordService";
import { isDev } from "../utils";
import { ApolloError, UserInputError } from "apollo-server-core";
import jwt from "jsonwebtoken";
import cloudinary from "cloudinary"
import { Message } from "../@types/express/entity/Message";
import pubsub, { MESSAGE_CREATED } from "../pubsub";
import { Chat } from "../@types/express/entity/Chat";
import { ReadStream } from "typeorm/platform/PlatformTools";
import { Book } from "../@types/express/entity/Book";

//TODO: error handling, move input validation to frontend, generate types

//TODO: FIX INPUTS
const userInputSchema = yup.object().shape({
  firstName: yup.string().min(1),
  lastName: yup.string().min(1),
  email: yup.string().email(),
  password: yup.string().min(8),
});

/*
interface UserInput {
  email: string;
  password: string;
}

interface MessageInput {
  receiverId: string;
  content: string;
}*/

//TODO: interface inputArg,...

//this is a placeholder return used because graphql does not allow returning void
interface MutationResult {
  success: boolean;
}

interface Context {
  req: Express.Request;
}

interface UserInput {
  password: string;
  email: string;
  firstName: string;
  lastName: string;
}

//TODO: refactor errors
const createUser = async (_, input: UserInput): Promise<User> => {
  try {
    await userInputSchema.validate({
      input,
    });
  } catch (e: any) {
    //TODO: yup error formatting
    if (e) {
      throw new UserInputError(e);

    }
  }

  const usedEmail = await User.findOne({ where: { email: input.email } });
  if (usedEmail) {
    throw new Error("Email already in use");
  }

  const user = new User();
  user.email = input.email;
  user.password = input.password;
  user.firstName = input.firstName;
  user.lastName = input.lastName;
  user.messages = [];
  user.chats = [];
  user.wanted = [];
  user.owned = [];
  await user.save();
  return user;
};

const deleteUser = async (_, { id }): Promise<MutationResult> => {
  const user = await User.findOne({ where: { id } });
  if (!user) {
    throw new Error("User not found");
  }
  User.delete(user);
  return {
    success: true,
  };
};

const createChat = async (_, { userId }, { req }): Promise<Chat> => {
  try {
    //the receiver
    const user = await User.findOne({ id: userId }, { relations: ["chats"] });
    //the sender (the user that's logged in) TODO: req.userId
    const me = await User.findOne({ id: req.userId }, { relations: ["chats"] })
    if (!me || !user) {
      throw new ApolloError("user not found");
    }
    const chat = new Chat();
    chat.name = null;
    //only group chats should have chat names
    chat.users = [user, me];
    chat.messages = [];
    const createdChat = await chat.save();
    me.chats.push(createdChat);
    user.chats.push(createdChat);
    return createdChat;
  } catch (e) {
    throw e;
  }
};

const createMessage = async (
  _,
  { chatId, content }, { req }
): Promise<Message> => {
  //TODO: front end validation
  try {
    const chat = await Chat.findOne({ id: chatId }, { relations: ["messages"] });
    const from = (await User.findOne({ where: { id: req.userId } }));

    //    const from = await User.findOne({ id: req.userId });
    if (!chat) {
      throw new Error("chat not found");
    }
    if (!from) {
      //TODO: maknut
      throw new Error("message sender (from) not found");
    }
    const message = new Message();
    message.content = content;
    message.chat = chat;
    message.from = from;
    const createdMessage = await message.save();
    chat.messages.push(createdMessage);
    //publishing the message for the messageCreated subscription
    await pubsub.publish(MESSAGE_CREATED, { messageCreated: createdMessage });
    return createdMessage;
  } catch (e) {
    console.log("createMesage error", e);
  }
};


// const deleteUser = async (_, { id }): Promise<MutationResult> => {
//   const user = await User.findOne({ where: { id } });
//   if (!user) {
//     throw new Error("User not found");
//   }
//   User.delete(user);
//   return {
//     success: true,
//   };
// };

const deleteMessage = async (_, { id }): Promise<MutationResult> => {
  await Message.delete({ id });
  return {
    success: true,
  };
};


const logIn = async (_, { email, password }, { req }: Context) => {
  //throwing an error if the user id is already set on req
  if ((req as any).userId) {
    throw new Error("A user is already logged in");
  }
  const user = await User.findOne({ where: { email } });
  //throwing an error if a user with the given email is not found
  if (!user) {
    throw new Error(isDev ? "Incorrect email" : "Incorrect password or email");
  }
  const hashed = user.password;

  //checking if the passwords match (using bcrypt)
  const isMatching = await comparePasswords(password, hashed);
  if (!isMatching) {
    throw new Error(
      isDev ? "Incorrect password" : "Incorrect password or email"
    );
  }

  const token = jwt.sign({ userId: user.id }, process.env.SECRET, {
    expiresIn: "1d",
  });
  //TOOD: decide if it needs to return the user
  return token;
};

const deleteChat = async (_, { id }, { req }) => {
  try {
    const chat = await Chat.findOne({ id }, { relations: ["users", "messages"] });
    if (!chat) {
      throw new ApolloError("Chat not found");
    }
    if (!chat.users.find(user => user.id === req.userId)) {
      throw new ApolloError("You do not have access to this chat");
    }
    await Message.remove(chat.messages);
    await Chat.remove(chat);
  } catch (e) {
    throw e;
  }
  return { success: true };
}


const uploadFile = async (file) => {
  const { createReadStream } = await file;
  const fileStream: ReadStream = createReadStream();
  cloudinary.v2.config({ cloud_name: "deoaakggx", api_key: "413696494632221", api_secret: "vIruondb1MyWq_1HcHksEHRTxHk" });
  return new Promise<any>((resolve, reject) => {
    const cloudStream = cloudinary.v2.uploader.upload_stream((err, uploadedFile) => {
      err ? reject(err) : resolve(uploadedFile);
    });
    fileStream.pipe(cloudStream);
  });

}
const uploadImage = async (_, { file }, { req }) => {
  try {
    const me = await User.findOne({ id: req.userId });
    const uploaded = await uploadFile(file);
    me.profileImageUrl = uploaded.secure_url;
    await me.save();
    return { success: true }
  } catch (e) {
    throw e;
  }
}

const uploadChatImage = async (_, { file, chatId }, { req }) => {
  try {
    const chat = await Chat.findOne({ id: chatId });
    if (!chat) {
      throw new ApolloError("Chat not found");
    }
    if (!chat.users.find(user => user.id === req.userId)) {
      throw new ApolloError("You do not have access to this chat");
    }
    const uploaded = await uploadFile(file);
    chat.imageUrl = uploaded.secure_url;
    await chat.save();
    return { success: true }
  } catch (e) {
    throw e;
  }
}

const addUserToChat = async (_, { userId, chatId }, { req }) => {
  try {
    const chat = await Chat.findOne({ id: chatId }, { relations: ["users"] });
    const user = await User.findOne({ id: userId });
    if (!user) {
      throw new ApolloError("User not found");
    }
    if (!chat) {
      throw new ApolloError("Chat not found");
    }
    if (!chat.users.find(user => user.id === req.userId)) {
      throw new ApolloError("You do not have access to this chat");
    }
    chat.users.push(user);
    await chat.save();
    return chat;
  } catch (e) {
    throw e;
  }
}

const removeUserFromChat = async (_, { userId, chatId }, { req }) => {
  try {
    const chat = await Chat.findOne({ id: chatId }, { relations: ["users"] });
    const user = await User.findOne({ id: userId });
    if (!user) {
      throw new ApolloError("User not found");
    }
    if (!chat) {
      throw new ApolloError("Chat not found");
    }
    if (!chat.users.find(user => user.id === req.userId)) {
      throw new ApolloError("You do not have access to this chat");
    }
    chat.users = chat.users.filter(user => user.id !== userId);
    await chat.save();
    return chat;
  } catch (e) {
    throw e;
  }
}


// createBook(id: ID, author: String, year: Int, coverUrl: String): Book
// deleteBook(id: ID): MutationResult

const createBook = async (_, { name, author, year, coverUrl }) => {
  try {
    const book = new Book();
    book.name = name;
    book.author = author;
    book.year = year;
    book.coverUrl = coverUrl;
    const createdBook = await book.save();
    return createdBook;
  } catch (e) {
    throw e;
  }
}

const deleteBook = async (_, { id }) => {
  try {
    await Book.delete({ id });
    return { success: true }
  } catch (e) {
    throw e;
  }
}

const addBookToWanted = async (_, { userId, bookId }, { req }) => {
  try {
    const book = await Book.findOne({ id: bookId });
    const user = await User.findOne({ id: userId }, { relations: ["wanted"] });
    if (!user) {
      throw new ApolloError("User not found");
    }
    if (!book) {
      throw new ApolloError("Book not found");
    }

    user.wanted.push(book)
    await user.save();
    return { success: true };
  } catch (e) {
    throw e;
  }
}

const addBookToOwned = async (_, { userId, bookId }, { req }) => {
  try {
    const book = await Book.findOne({ id: bookId });
    const user = await User.findOne({ id: userId }, { relations: ["owned"] });
    if (!user) {
      throw new ApolloError("User not found");
    }
    if (!book) {
      throw new ApolloError("Book not found");
    }

    user.owned.push(book)
    await user.save();
    return { success: true };
  } catch (e) {
    throw e;
  }
}

const mutationResolvers = {
  Mutation: {
    createUser,
    deleteUser,
    addUserToChat,
    logIn,
    createMessage,
    deleteMessage,
    createChat,
    deleteChat,
    uploadImage,
    uploadChatImage,
    removeUserFromChat,
    createBook,
    deleteBook,
    addBookToOwned,
    addBookToWanted
  },
};

export default mutationResolvers;
