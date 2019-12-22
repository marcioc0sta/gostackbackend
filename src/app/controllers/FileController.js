const File = require('../models/File');

class FileController {
  async store(request, response) {
    const { originalname: name, filename: path } = request.file;

    const file = await File.create({
      name,
      path
    });

    return response.json(file);
  }
}

module.exports = new FileController();
