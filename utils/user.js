// utils/user.js
const dbClient = require('./db');

class User {
  static async create(email, password) {
    const hash = crypto.createHash('sha1').update(password).digest('hex');
    const newUser = await dbClient.db.collection('users').insertOne({
      email,
      password: hash,
    });
    return newUser;
  }

  static async findByEmail(email) {
    const user = await dbClient.db.collection('users').findOne({ email });
    return user;
  }
}

module.exports = User;
