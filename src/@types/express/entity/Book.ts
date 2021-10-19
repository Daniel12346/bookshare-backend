import {
    PrimaryGeneratedColumn,
    Column,
    Entity,
    BaseEntity,
    //ManyToMany,
    ManyToOne,
    JoinTable,
    ManyToMany
    //ManyToOne
} from "typeorm";
import { User } from "./User";

//TODO: koristit API?
@Entity()
export class Book extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    name: string;

    @Column()
    author: string;

    @Column()
    year: number;

    @Column({ nullable: true })
    coverUrl: string

    @ManyToMany(() => User, (user) => user.owned)
    @JoinTable()
    ownedBy: User[];

    @ManyToMany(() => User, (user) => user.wanted)
    @JoinTable()
    wantedBy: User[];

}

