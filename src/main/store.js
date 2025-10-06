const { app } = require('electron');
const path = require('path');
const fs = require('fs-extra');

const storePath = path.join(app.getPath('userData'), 'store.json');

function readStore() {
  try {
    return fs.readJsonSync(storePath, { throws: false }) || {};
  } catch (error) {
    console.error('Failed to read store:', error);
    return {};
  }
}

function writeStore(data) {
  try {
    fs.writeJsonSync(storePath, data, { spaces: 2 });
  } catch (error) {
    console.error('Failed to write store:', error);
  }
}

module.exports = { readStore, writeStore };