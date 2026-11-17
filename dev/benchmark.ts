export const benchmarkMarkdown = (topics: number, areas: number, leaves: number): string => {
  const lines = ['# Benchmark map', ''];
  for (let topic = 1; topic <= topics; topic += 1) {
    lines.push(`## Topic ${topic}`, '');
    for (let area = 1; area <= areas; area += 1) {
      lines.push(`### Area ${topic}.${area}`, '');
      for (let leaf = 1; leaf <= leaves; leaf += 1) {
        lines.push(`- Leaf ${topic}.${area}.${leaf}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
};
