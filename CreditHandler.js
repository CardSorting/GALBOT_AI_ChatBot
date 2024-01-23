const CheckCreditsCommand = require('./checkCredits.js');
const AddCreditsCommand = require('./addCredits.js'); // Required AddCreditsCommand
const creditslog = require('./credit');

class CreditHandler {
  constructor(creditManager) {
    this.creditManager = creditManager;

    this.checkCredits = new CheckCreditsCommand(this.creditManager);
    this.addCredits = new AddCreditsCommand(this.creditManager); // Initialized AddCreditsCommand

    this.commandHandlers = {
      'checkcredits': this.checkCredits.execute.bind(this.checkCredits),
      'addcredits': this.addCredits.execute.bind(this.addCredits), // Added the addCredits command handler
    };

    creditslog.info('CreditHandler initialized');
  }

  getCommandData() {
    return [this.checkCredits.data, this.addCredits.data]; // Added the addCredits data
  }

  async handleInteraction(interaction) {
    const commandName = interaction.commandName;
    if (commandName in this.commandHandlers) {
      creditslog.debug(`Handling ${commandName} command`);
      try {
        await this.commandHandlers[commandName](interaction);
      } catch (error) {
        creditslog.error(`Error executing command ${commandName}: ${error.message}`);
      }
    }
  }
}

module.exports = CreditHandler;