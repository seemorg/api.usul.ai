import { BookDetailsResponse } from '@/routes/book/details';

function _getHeadings(headings: BookDetailsResponse['headings'], levels: number[]) {
  const newHeadings = [];

  for (const heading of headings) {
    if (levels.includes(heading.level)) {
      newHeadings.push(heading);
    }
  }

  return newHeadings;
}

export const truncateHeadings = (details: BookDetailsResponse, max = 50) => {
  const currentLevels = [1];
  let newHeadings = [];

  while (newHeadings.length === details.headings.length) {
    const newLevelHeadings = _getHeadings(details.headings, currentLevels);
    if (newLevelHeadings.length > max) {
      if (currentLevels.length === 1) {
        newHeadings = newLevelHeadings;
      }

      break;
    }

    currentLevels.push(currentLevels[currentLevels.length - 1] + 1);
  }

  return newHeadings;
};
