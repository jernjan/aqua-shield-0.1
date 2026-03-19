const fs = require('fs');

function findUnbalancedBracket(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const lines = content.split('\n');
  
  let braceBalance = 0;
  let parenBalance = 0;
  let bracketBalance = 0;
  let lastGoodLine = 0;
  
  let inString = false;
  let stringChar = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const prev = j > 0 ? line[j-1] : null;
      
      // Skip escaped quotes
      if ((char === '"' || char === "'" || char === '`') && prev !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = null;
        }
      }
      
      // Skip if in string
      if (inString) continue;
      
      // Skip comments
      if (char === '/' && j+1 < line.length && line[j+1] === '/') break;
      
      // Count brackets
      if (char === '{') braceBalance++;
      if (char === '}') braceBalance--;
      if (char === '(') parenBalance++;
      if (char === ')') parenBalance--;
      if (char === '[') bracketBalance++;
      if (char === ']') bracketBalance--;
      
      // Track last good line
      if (braceBalance === 0 && parenBalance === 0 && bracketBalance === 0) {
        lastGoodLine = i + 1;
      }
    }
  }
  
  
  
  
  
  
  
  
  if (braceBalance !== 0 || parenBalance !== 0 || bracketBalance !== 0) {
    
    if (braceBalance > 0) 
    if (braceBalance < 0) 
    if (parenBalance > 0) 
    if (parenBalance < 0) 
    return false;
  }
  
  return true;
}

findUnbalancedBracket('routes-planner.js');
findUnbalancedBracket('vessel.js');
