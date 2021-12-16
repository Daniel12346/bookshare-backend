import { User } from "../@types/express/entity/User";
import { AuthenticationError } from "apollo-server-core";
import { Book } from "../@types/express/entity/Book";



interface Request {
  userId: string;
  isAuth: Boolean;
}
interface Context {
  req: Request;
}


//TODO: fix
const me = (_, __, { req }: Context) => {
  if (!req.isAuth) {
    throw new AuthenticationError("Not authenticated");
  }

  return User.findOne({ id: req.userId }, { relations: ["wanted", "owned"] });
};
//finds a single user by id

//TODO: odvojit u dvi funkcije (jedna sa wanted i owned ?)
const user = (_, { id }: { [key: string]: string }, { req }: Context) => {
  return User.findOne({ id }, { relations: ["wanted", "owned"] });
};

//finds all users
const users = async () => {
  return User.find();
};


const books = async () => {
  return Book.find({ relations: ["wantedBy", "ownedBy"] });
};

const book = async (_, { id }) => {
  return Book.findOne({ id }, { relations: ["wantedBy", "ownedBy"] });
};


const queryResolvers = {
  Query: {
    me,
    user,
    users,
    book,
    books
  },
};

export default queryResolvers;
