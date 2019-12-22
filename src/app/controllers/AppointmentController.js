const Yup = require('yup');
const {
  startOfHour,
  parseISO,
  isBefore,
  format,
  subHours
} = require('date-fns');
const pt = require('date-fns/locale/pt');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const File = require('../models/File');
const Notification = require('../schemas/Notification');
const Queue = require('../../lib/Queue');
const CancellationMail = require('../jobs/CancellationMail');

class AppointmentController {
  async index(request, response) {
    const { page = 1 } = request.query;

    const appointments = await Appointment.findAll({
      where: { user_id: request.userId, canceled_at: null },
      attributes: ['id', 'date', 'past', 'cancelable'],
      limit: 10,
      offset: (page - 1) * 10,
      order: ['date'],
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['id', 'path', 'url']
            }
          ]
        }
      ]
    });

    return response.json(appointments);
  }

  async store(request, response) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required()
    });

    if (!(await schema.isValid(request.body))) {
      return response.status(400).json({ error: 'Validation failed' });
    }

    const { provider_id, date } = request.body;

    const isProvider = await User.findOne({
      where: {
        id: provider_id,
        provider: true
      }
    });

    if (!isProvider) {
      return response
        .status(401)
        .json({ error: 'You can only create appointments with providers' });
    }

    const startHour = startOfHour(parseISO(date));

    if (isBefore(startHour, new Date())) {
      return response
        .status(400)
        .json({ error: 'Past dates are not permited' });
    }

    const checkAvailability = await Appointment.findOne({
      where: {
        provider_id,
        canceled_at: null,
        date: startHour
      }
    });

    if (checkAvailability) {
      return response
        .status(400)
        .json({ error: 'Appointment date is not available' });
    }

    if (request.userId === provider_id) {
      return response.status(400).json({
        error: 'A provider can not schedule an appointment to himself'
      });
    }

    const appointment = await Appointment.create({
      user_id: request.userId,
      provider_id,
      date
    });

    const user = await User.findByPk(request.userId);
    const formattedDate = format(
      startHour,
      "'dia' dd 'de' MMMM', às' H:mm'h'",
      { locale: pt }
    );

    await Notification.create({
      content: `Novo agendamento de ${user.name} para ${formattedDate}`,
      user: provider_id
    });

    return response.json(appointment);
  }

  async delete(request, response) {
    const appointment = await Appointment.findByPk(request.params.id, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email']
        },
        {
          model: User,
          as: 'user',
          attributes: ['name']
        }
      ]
    });

    if (appointment.user_id !== request.userId) {
      return response.status(401).json({
        error: "You don't have permission to cancel this appointment"
      });
    }

    const subtractionAmount = 2;
    const dateWithSubtraction = subHours(appointment.date, subtractionAmount);

    if (isBefore(dateWithSubtraction, new Date())) {
      return response.status(401).json({
        error: 'You can only cancel appointments with 2 hours in advance'
      });
    }

    appointment.canceled_at = new Date();

    await appointment.save();

    await Queue.add(CancellationMail.key, {
      appointment
    });

    return response.json(appointment);
  }
}

module.exports = new AppointmentController();
