const Mongoose = require('mongoose');

const NotificationSchema = new Mongoose.Schema(
  {
    content: {
      type: String,
      required: true
    },
    user: {
      type: Number,
      required: true
    },
    read: {
      type: Boolean,
      required: true,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = Mongoose.model('Notification', NotificationSchema);
