import { ObjectId } from 'mongodb';
import mime from 'mime-types';
import Queue from 'bull';
import userUtils from '../utils/user';
import fileUtils from '../utils/file';
import basicUtils from '../utils/basic';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
const fileQueue = new Queue('fileQueue');

class FilesController {
  /**
   * Creates a new file in DB and on disk
   * @param {Object} request - The request object
   * @param {Object} response - The response object
   * @returns {Object} - Returns a JSON object with the file and status code
   */
  static async postUpload(request, response) {
    try {
      const { userId } = await userUtils.getUserIdAndKey(request);

      if (!basicUtils.isValidId(userId)) {
        return response.status(401).json({ error: 'Unauthorized' });
      }

      const user = await userUtils.getUser({ _id: ObjectId(userId) });

      if (!user) {
        return response.status(401).json({ error: 'Unauthorized' });
      }

      const { error: validationError, fileParams } = await fileUtils.validateBody(request);

      if (validationError) {
        return response.status(400).json({ error: validationError });
      }

      if (fileParams.parentId !== 0 && !basicUtils.isValidId(fileParams.parentId)) {
        return response.status(400).json({ error: 'Parent not found' });
      }

      const { error, code, newFile } = await fileUtils.saveFile(userId, fileParams, FOLDER_PATH);

      if (error) {
        return response.status(code).json({ error });
      }

      if (fileParams.type === 'image') {
        await fileQueue.add({ fileId: newFile.id.toString(), userId: newFile.userId.toString() });
      }

      return response.status(201).json(newFile);
    } catch (error) {
      console.error('Error uploading file:', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Retrieves a file document based on the ID
   * @param {Object} request - The request object
   * @param {Object} response - The response object
   * @returns {Object} - Returns a JSON object with the file and status code
   */
  static async getShow(request, response) {
    try {
      const fileId = request.params.id;
      const { userId } = await userUtils.getUserIdAndKey(request);

      if (!basicUtils.isValidId(fileId) || !basicUtils.isValidId(userId)) {
        return response.status(404).json({ error: 'Not found' });
      }

      const user = await userUtils.getUser({ _id: ObjectId(userId) });

      if (!user) {
        return response.status(401).json({ error: 'Unauthorized' });
      }

      const result = await fileUtils.getFile({ _id: ObjectId(fileId), userId: ObjectId(userId) });

      if (!result) {
        return response.status(404).json({ error: 'Not found' });
      }

      const file = fileUtils.processFile(result);
      return response.status(200).json(file);
    } catch (error) {
      console.error('Error retrieving file:', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Retrieves all user file documents for a specific parentId with pagination
   * @param {Object} request - The request object
   * @param {Object} response - The response object
   * @returns {Object} - Returns a JSON object with the files and status code
   */
  static async getIndex(request, response) {
    try {
      const { userId } = await userUtils.getUserIdAndKey(request);

      if (!userId) {
        return response.status(401).json({ error: 'Unauthorized' });
      }

      const user = await userUtils.getUser({ _id: ObjectId(userId) });

      if (!user) {
        return response.status(401).json({ error: 'Unauthorized' });
      }

      const parentId = request.query.parentId || '0';
      if (parentId !== '0' && !basicUtils.isValidId(parentId)) {
        return response.status(400).json({ error: 'Invalid parentId' });
      }

      let page = Number(request.query.page) || 0;
      if (Number.isNaN(page)) {
        page = 0;
      }

      const pipeline = [
        { $match: { parentId: parentId === '0' ? 0 : ObjectId(parentId) } },
        { $skip: page * 20 },
        { $limit: 20 },
      ];

      const fileCursor = await fileUtils.getFilesOfParentId(pipeline);
      const fileList = [];

      await fileCursor.forEach((doc) => {
        const document = fileUtils.processFile(doc);
        fileList.push(document);
      });

      return response.status(200).json(fileList);
    } catch (error) {
      console.error('Error retrieving files:', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Sets isPublic to true on the file document based on the ID
   * @param {Object} request - The request object
   * @param {Object} response - The response object
   * @returns {Object} - Returns a JSON object with the updated file and status code
   */
  static async putPublish(request, response) {
    try {
      const { error, code, updatedFile } = await fileUtils.publishUnpublish(request, true);

      if (error) {
        return response.status(code).json({ error });
      }

      return response.status(code).json(updatedFile);
    } catch (error) {
      console.error('Error publishing file:', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Sets isPublic to false on the file document based on the ID
   * @param {Object} request - The request object
   * @param {Object} response - The response object
   * @returns {Object} - Returns a JSON object with the updated file and status code
   */
  static async putUnpublish(request, response) {
    try {
      const { error, code, updatedFile } = await fileUtils.publishUnpublish(request, false);

      if (error) {
        return response.status(code).json({ error });
      }

      return response.status(code).json(updatedFile);
    } catch (error) {
      console.error('Error unpublishing file:', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Returns the content of the file document based on the ID
   * @param {Object} request - The request object
   * @param {Object} response - The response object
   * @returns {Object} - Returns the file content with the correct MIME type and status code
   */
  static async getFile(request, response) {
    try {
      const { userId } = await userUtils.getUserIdAndKey(request);
      const { id: fileId } = request.params;
      const size = request.query.size || 0;

      if (!basicUtils.isValidId(fileId)) {
        return response.status(404).json({ error: 'Not found' });
      }

      const file = await fileUtils.getFile({ _id: ObjectId(fileId) });

      if (!file || !fileUtils.isOwnerAndPublic(file, userId)) {
        return response.status(404).json({ error: 'Not found' });
      }

      if (file.type === 'folder') {
        return response.status(400).json({ error: "A folder doesn't have content" });
      }

      const { error, code, data } = await fileUtils.getFileData(file, size);

      if (error) {
        return response.status(code).json({ error });
      }

      const mimeType = mime.contentType(file.name);

      response.setHeader('Content-Type', mimeType);
      return response.status(200).send(data);
    } catch (error) {
      console.error('Error retrieving file content:', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default FilesController;
