import getReadingTime from 'reading-time';
import { toString } from 'mdast-util-to-string';

/**
 * Remark plugin: compute an estimated reading time from the document text and
 * inject it into the page frontmatter as `minutesRead` (e.g. "4 min read").
 * Read by DocLayout.astro for the clock-icon meta row.
 */
export function remarkReadingTime() {
  return function (tree, { data }) {
    const textOnPage = toString(tree);
    const readingTime = getReadingTime(textOnPage);
    data.astro.frontmatter.minutesRead = readingTime.text;
  };
}
