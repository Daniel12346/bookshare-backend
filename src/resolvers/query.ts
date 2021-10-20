import { User } from "../@types/express/entity/User";
import { Message } from "../@types/express/entity/Message";
import { Chat } from "../@types/express/entity/Chat";
import { AuthenticationError } from "apollo-server-core";
import { Book } from "../@types/express/entity/Book";

interface Context {
  req: Request;
}

const me = (_, __, { req }) => {
  if (!req.isAuth) {
    throw new AuthenticationError("Not authenticated");
  }
  return User.findOne({ id: req.userId }, { relations: ["messages", "chats", "chats.messages", "chats.users", "wanted", "owned"] });
};
//finds a single user by id

//TODO: odvojit u dvi funkcije (jedna sa wanted i owned ?)
const user = (_, { id }: { [key: string]: string }, { req }: Context) => {
  return User.findOne({ id }, { relations: ["messages", "chats", "wanted", "owned"] });
};

//finds all users
const users = async () => {
  return User.find();
};


const books = async () => {
  return Book.find({ relations: ["wantedBy, ownedBy"] });
};

const book = async (_, { id }) => {
  return Book.findOne({ id }, { relations: ["wantedBy, ownedBy"] });
};

const messages = async () => {
  try {
    const m = await Message.find({ relations: ["from", "chat"] });
    console.log(m);
    return m;
  } catch (e) {
    throw new Error(e);
  }
};
const chats = async () => {
  try {
    return await Chat.find({ relations: ["users", "messages"] });
  } catch (e) {
    throw new Error(e);
  }
};

const chat = async (_, { id }) => {
  try {
    return await Chat.findOne({ id }, { relations: ["users", "messages", "messages.from", "messages.chat"] });
  } catch (e) {
    throw new Error(e);
  }
};

const queryResolvers = {
  Query: {
    me,
    user,
    users,
    messages,
    chats,
    chat,
  },
};

export default queryResolvers;
