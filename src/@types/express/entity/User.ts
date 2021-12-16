import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BeforeInsert,
  BaseEntity,
  OneToMany,
  ManyToMany,
} from "typeorm";

import { hashPassword } from "../../../utils/passwordService";

import { Book } from "./Book"

@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  profileImageUrl: string;


  @ManyToMany(() => Book, (book) => book.ownedBy)
  owned: Book[];

  @ManyToMany(() => Book, (book) => book.wantedBy)
  wanted: Book[]


  @BeforeInsert()
  async hash() {
    this.password = await hashPassword(this.password);
  }
}
