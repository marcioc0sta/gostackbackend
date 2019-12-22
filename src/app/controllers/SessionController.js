const jwt = require('jsonwebtoken');
const Yup = require('yup');

const User = require('../models/User');
const authConfig = require('../../config/auth');

class SessionController {
  async store(request, response) {
    const { email, password } = request.body;
    const user = await User.findOne({ where: { email } });

    const schema = Yup.object().shape({
      email: Yup.string()
        .email()
        .required(),
      password: Yup.string().required()
    });

    if (!(await schema.isValid(request.body))) {
      response.status(400).json({ error: 'Validation failed' });
    }

    if (!user) {
      return response.status(401).json({ error: 'User not found' });
    }

    if (!(await user.checkPassword(password))) {
      return response.status(401).json({ error: 'Password does not match' });
    }

    const { id, name } = user;

    return response.json({
      user: {
        id,
        name,
        email
      },
      token: jwt.sign({ id }, authConfig.secret, {
        expiresIn: authConfig.expiresIn
      })
    });
  }
}

module.exports = new SessionController();
