import "reflect-metadata";
import { GraphQLUpload, graphqlUploadExpress } from "graphql-upload"
import readSchemas from "./src/utils/readSchema";
import { createConnection } from "typeorm";
import { ApolloServer, gql } from "apollo-server-express";
import mutationResolvers from "./src/resolvers/mutation";
import queryResolvers from "./src/resolvers/query";
import isAuth from "./src/middleware/auth";
import express, { Request } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import http from "http";
import { User } from "./src/@types/express/entity/User";
import { Book } from "./src/@types/express/entity/Book";
import { transporter } from "./src/nodemailerTransporter";

dotenv.config();

//setting up the middleware
const app = express();
app.use(cors({ credentials: true, origin: "http://localhost:3000" }) as any);
app.use(graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 20 }) as any);
app.use(isAuth);

const allSchemas = readSchemas(
  "./src/schemas/book.gql",
  "./src/schemas/user.gql",
  "./src/schemas/mutation.gql",
  "./src/schemas/query.gql",

);
const typeDefs = gql(allSchemas.join());
const resolvers = {
  Upload: GraphQLUpload,
  ...mutationResolvers,
  ...queryResolvers,
};
const createServer = () => {
  return new ApolloServer({
    typeDefs,
    resolvers,
    playground: true,
    introspection: true,
    uploads: false,
    context: ({ req }: { [key: string]: Request }) => ({
      req,
    }),
  });
};

//the config is here because typeorm couldn't find the names of the databases in ormconfig.js
const ormConfig: PostgresConnectionOptions[] = [
  {
    host: "localhost",
    type: "postgres",
    port: 5400,
    username: "test",
    password: "test",
    database: "test",
    logging: false,
    entities: [User, Book],
    migrations: ["src/migration/**/*.ts"],
    subscribers: ["src/subscriber/**/*.ts"],
    synchronize: false,
    ssl: {
      rejectUnauthorized: false
    },

    //dropSchema: true,
    cli: {
      entitiesDir: "src/entity",
      migrationsDir: "src/migration",
      subscribersDir: "src/subscriber",
    },
  },
  {
    url: "postgres://zsiyghdkcnigcd:15675a9a7837fd043455e2d220060498e079e3a9688d95130bdefe562c7a5152@ec2-52-19-164-214.eu-west-1.compute.amazonaws.com:5432/d86jnkd8kpm21e",
    type: "postgres",
    synchronize: true,
    port: 5432,
    //TODO: test
    entities: [User, Book],
    migrations: ["src/migration/**/*.ts"],
    subscribers: ["src/subscriber/**/*.ts"],
    cli: {
      entitiesDir: "src/entity",
      migrationsDir: "src/migration",
      subscribersDir: "src/subscriber",
    },
    ssl: {
      rejectUnauthorized: false
    }
  },
];

const startServer = async () => {
  const port = process.env.PORT || 8000;

  const server = createServer();
  await createConnection(
    ormConfig[1]
    /*process.env.NODE_ENV === "development"
      ? //local database
        (ormConfig[0] as PostgresConnectionOptions)
      : //heroku database
        (ormConfig[1] as PostgresConnectionOptions)*/
  );


  const httpServer = http.createServer(app);

  //TOOD: custom store (redis)

  //setting cors to false so apollo server does not override the cors settings
  server.applyMiddleware({ app, cors: false });
  console.log(`PORT: ${process.env.DATABASE_URL}`)

  const mailOptions = {
    from: '"Example Team" <from@example.com>',
    to: 'danezoki@gmail.com',
    subject: 'App Started Test Mail',
    text: 'Hey there, it’s our first message sent with Nodemailer ;) ',
    html: '<b>Hey there! </b><br> This is our first message sent with Nodemailer'
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log("mail sent");
  } catch (e) {
    console.log(e);
  }
  //server.installSubscriptionHandlers(httpServer);
  httpServer.listen(
    port /*() => {
    console.log(`Listening to port: ${port}${server.graphqlPath}`);
    console.log(
      `Subscriptions ready at ws://localhost:${port}${server.subscriptionsPath}`
    );
  }*/
  );
};


export default startServer;

