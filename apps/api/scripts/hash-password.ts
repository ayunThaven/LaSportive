import { hashPassword } from "../src/security/password.js";

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error("Le mot de passe doit contenir au moins 8 caractères.");
  process.exit(1);
}
console.log(await hashPassword(password));
