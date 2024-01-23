const { SlashCommandBuilder } = require('@discordjs/builders');
const axios = require('axios');
const fastq = require('fastq');
const BackblazeB2 = require('backblaze-b2');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class SelfieCommandHandler {
    constructor() {
        this.validateEnvVars(['B2_APPLICATION_KEY_ID', 'B2_APPLICATION_KEY', 'B2_BUCKET_ID_ROCKET', 'B2_BUCKET_NAME_ROCKET', 'OPENAI_API_KEY']);
        this.scenes = this.loadScenesFromJson(path.join(__dirname, 'scenes.json'));
        this.b2 = new BackblazeB2({
            applicationKeyId: process.env.B2_APPLICATION_KEY_ID,
            applicationKey: process.env.B2_APPLICATION_KEY,
        });
        this.queue = fastq.promise(this.imageWorker.bind(this), 5);
    }

    validateEnvVars(vars) {
        vars.forEach(varName => {
            if (!process.env[varName]) {
                throw new Error(`Missing required environment variable: ${varName}`);
            }
        });
    }

    loadScenesFromJson(jsonPath) {
        return JSON.parse(fs.readFileSync(jsonPath, 'utf-8')).photoOps;
    }

    getCommandData() {
        return new SlashCommandBuilder()
            .setName('selfie')
            .setDescription('Ask for a selfie from GAL')
            .toJSON();
    }

    async handleInteraction(interaction) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }
        this.queue.push({ interaction, prompt: this.getRandomScene().description });
    }

    getRandomScene() {
        return this.scenes[Math.floor(Math.random() * this.scenes.length)];
    }

    async createImage(prompt) {
        const url = 'https://api.openai.com/v1/images/generations';
        const headers = {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        };

        const data = {
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024"
        };

        try {
            const response = await axios.post(url, data, { headers: headers });
            logger.info({ message: 'Image generated successfully', prompt: prompt });
            return response.data.data[0].url;
        } catch (error) {
            this.logError('Error in createImage', prompt, error);
            throw new Error('Failed to generate image');
        }
    }

    async backupToBackblaze(imageUrl, prompt) {
        let fileName;
        try {
            logger.info('Starting authorization with Backblaze B2');
            await this.b2.authorize();
            logger.info('Authorization successful');

            logger.info({ message: 'Fetching image data', imageUrl: imageUrl });
            const imageData = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            logger.info('Image data fetched successfully');

            const bucketId = process.env.B2_BUCKET_ID_ROCKET;
            const bucketName = process.env.B2_BUCKET_NAME_ROCKET;
            if (!bucketId || !bucketName) {
                throw new Error('Backblaze B2 bucket ID or name is not set');
            }

            const uploadUrl = await this.b2.getUploadUrl({ bucketId: bucketId });
            const sanitizedPrompt = prompt.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
            fileName = `images/${sanitizedPrompt}_${Date.now()}.png`;

            logger.info({ message: 'Starting image upload to Backblaze B2', fileName: fileName });
            await this.b2.uploadFile({
                uploadUrl: uploadUrl.data.uploadUrl,
                uploadAuthToken: uploadUrl.data.authorizationToken,
                fileName: fileName,
                data: imageData.data,
                mime: 'image/png',
            });

            const backblazeUrl = `https://f005.backblazeb2.com/file/${bucketName}/${fileName}`;
            logger.info(`Backup successful for ${fileName}`);
            return backblazeUrl;
        } catch (error) {
            this.logError('Error during backup to Backblaze', prompt, error);
            throw new Error('Failed to backup image');
        }
    }

  async imageWorker(task, callback) {
      try {
          const imageUrl = await this.createImage(task.prompt);
          const backblazeUrl = await this.backupToBackblaze(imageUrl, task.prompt);
          // Check if the interaction has already been replied or edited
          if (!task.interaction.deferred && !task.interaction.replied) {
              await task.interaction.editReply({ content: backblazeUrl });
          } else {
              // If already replied or deferred, use followUp to send the URL
              await task.interaction.followUp({ content: backblazeUrl });
          }
      } catch (error) {
          this.logError('Error in imageWorker', task.prompt, error);
          if (!task.interaction.deferred && !task.interaction.replied) {
              await task.interaction.editReply({ content: 'Error in processing your request.' });
          } else {
              await task.interaction.followUp({ content: 'Error in processing your request.' });
          }
      } finally {
          callback();
      }
  }

    logError(message, prompt, error) {
        logger.error({
            message: message,
            prompt: prompt,
            error: error.message,
            stack: error.stack
        });
    }
}

module.exports = SelfieCommandHandler;