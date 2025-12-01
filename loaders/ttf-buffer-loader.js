import { readFileSync } from 'fs';

const loader = function () {
  // Ensure Webpack knows this result is cacheable
  if (this.cacheable) {
    this.cacheable();
  }

  // Absolute path to the .ttf file
  const filePath = this.resourcePath;

  // Read file into a raw buffer
  const buffer = readFileSync(filePath);

  // Convert the buffer to base64 so we can inline it into JS
  const base64 = buffer.toString('base64');

  // Emit module code exporting a Node.js Buffer
  return `
    const data = Buffer.from('${base64}', 'base64');
    export default data;
  `;
};

export default loader;
