/* eslint-disable no-undef */
import { LoremIpsum } from 'lorem-ipsum'

// Create singleton instance with configuration
const loremConfig = {
  sentencesPerParagraph: {
    max: 8,
    min: 4
  },
  wordsPerSentence: {
    max: 16,
    min: 4
  }
}

const lorem = new LoremIpsum(loremConfig)

// Group related commands
const textGenerationCommands = {
  generateWords: (wordCount = 10) => cy.wrap(lorem.generateWords(wordCount)),
  generateSentences: (sentenceCount = 10) => cy.wrap(lorem.generateSentences(sentenceCount)),
  generateParagraphs: (paragraphCount = 10) => cy.wrap(lorem.generateParagraphs(paragraphCount)),
  generateParagraph: () => cy.wrap(lorem.generateParagraphs(1))
}

// Register commands
Object.entries(textGenerationCommands).forEach(([commandName, commandFn]) => {
  Cypress.Commands.add(commandName, commandFn)
})
