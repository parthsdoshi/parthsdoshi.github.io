export function getReadingTime(content: string): number {
  // Split content at "## Appendix" or similar heading variations
  const mainContent = content.split(/^##\s*Appendix/m)[0];

  const wordsPerMinute = 200;
  const words = mainContent.trim().split(/\s+/).length;
  const time = Math.ceil(words / wordsPerMinute);
  return time;
}
