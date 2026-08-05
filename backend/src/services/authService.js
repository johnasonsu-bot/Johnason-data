const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

async function findUserByUsername(username) {
  const [rows] = await pool.query(
    "SELECT id, username, password_hash, display_name FROM users WHERE username = ? LIMIT 1",
    [username]
  );
  return rows[0] || null;
}

async function login(username, password) {
  const user = await findUserByUsername(username);

  if (!user) {
    throw new Error("用户名或密码错误");
  }

  const passwordMatched = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatched) {
    throw new Error("用户名或密码错误");
  }

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      displayName: user.display_name
    },
    process.env.JWT_SECRET || "medata-dev-secret",
    { expiresIn: "8h" }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name
    }
  };
}

module.exports = {
  login
};
