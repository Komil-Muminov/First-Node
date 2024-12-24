import ms from "ms";
import { nanoid } from "nanoid";

const ttl = ms("1d");
const uid = nanoid();

console.log(ttl);
