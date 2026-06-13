const triggerDictionary = {
  highRisk: [
    'bunuh', 'mati', 'ancam', 'mengancam', 'diancam', 'pukul', 'dipukul', 'hajar', 'dihajar',
    'tampar', 'ditampar', 'cekik', 'dicekik', 'bunuh diri', 'self harm', 'sayat',
    'kunci', 'dikunci', 'seksual', 'raba', 'diraba', 'leceh', 'dilecehkan', 'perkosa',
    'diperkosa', 'paksa', 'dipaksa', 'sebar video', 'sebar foto', 'telanjang',
    'senjata', 'pisau', 'darah', 'luka', 'depresi berat', 'akhiri hidup', 'doxing'
  ],
  medRisk: [
    'hina', 'menghina', 'ejek', 'diejek', 'olok', 'diolok', 'kucil', 'dikucilkan',
    'jauhi', 'dijauhi', 'fitnah', 'difitnah', 'cyberbullying', 'komentar jahat',
    'bodoh', 'jelek', 'miskin', 'cacat', 'sialan', 'palak', 'dipalak', 'uang',
    'ancaman ringan', 'intimidasi', 'malu', 'dipermalukan', 'labrak', 'dilabrak',
    'grup', 'sindir', 'disindir', 'toxic'
  ]
};

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordMatches(text, keyword) {
  const normalizedKeyword = String(keyword).toLowerCase();

  if (normalizedKeyword.includes(' ')) {
    return text.includes(normalizedKeyword);
  }

  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegex(normalizedKeyword)}(?![\\p{L}\\p{N}_])`, 'u');
  return pattern.test(text);
}

function classifyRisk(message) {
  const lowerText = String(message || '').toLowerCase();
  let score = 0;
  let foundHighRisk = false;
  const matchedKeywords = [];

  triggerDictionary.highRisk.forEach((word) => {
    if (keywordMatches(lowerText, word)) {
      score += 5;
      foundHighRisk = true;
      matchedKeywords.push(word);
    }
  });

  triggerDictionary.medRisk.forEach((word) => {
    if (keywordMatches(lowerText, word)) {
      score += 2;
      matchedKeywords.push(word);
    }
  });

  let level = 'low';
  if (score >= 5 || foundHighRisk) level = 'high';
  else if (score >= 2) level = 'medium';

  return { score, level, foundHighRisk, matchedKeywords };
}

module.exports = { classifyRisk, triggerDictionary };
