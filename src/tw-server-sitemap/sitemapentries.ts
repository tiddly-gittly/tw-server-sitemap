/**
Macro to output tiddlers matching a filter to sitemap.xml entries.
http://www.sitemaps.org/protocol.html
*/

import type { ITiddlerFields } from 'tiddlywiki';

declare let exports: {
  name: string;
  params: Array<{ name: string }>;
  run: (filter: string) => string;
};

exports.name = 'sitemapentries';

exports.params = [{ name: 'filter' }];

const escapify = (input: string | undefined) => {
  if (typeof input !== 'string') input = '';
  return input
    .replaceAll(/</gm, '&lt;')
    .replaceAll(/>/gm, '&gt;')
    .replaceAll(/&/gm, '&amp;')
    .replaceAll(/"/gm, '&quot;')
    .replaceAll(/'/gm, '&apos;');
};

const twDateToWebDate = (twDate: Date) => {
  return $tw.utils.formatDateString(twDate, 'YYYY-0MM-0DD');
};

const stringify = (data: ITiddlerFields[]) => {
  let x = '';
  let server = $tw.wiki.getTiddlerText('$:/plugins/linonetwo/tw-server-sitemap/configs/WebsiteURL', '');
  if (!server.endsWith('/')) {
    server += '/';
  }
  const useHash = $tw.wiki.getTiddlerText('$:/plugins/linonetwo/tw-server-sitemap/configs/UseHashVersion', 'no') === 'yes';
  data.forEach((element) => {
    x += '\t<url>\n';
    x += `\t\t<loc>${server}${useHash ? '#:' : ''}${element.title.replaceAll(' ', '%2520')}</loc>\n`;
    if (element.modified) {
      x += '\t\t<lastmod>' + twDateToWebDate($tw.utils.parseDate(element.modified)!) + '</lastmod>\n';
    }
    x += '\t\t<changefreq>';
    if (element.title.toLowerCase() === 'index' || element.title.toLowerCase() === 'home') {
      x += 'weekly';
    } else {
      x += 'monthly';
    }
    x += '</changefreq>\n';
    x += '\t\t<priority>';
    if (element.title.toLowerCase() === 'index' || element.title.toLowerCase() === 'home') {
      x += '1.0';
    } else if (element.color === undefined) {
      x += '0.5';
    } else {
      x += '0.8';
    }
    x += '</priority>\n';
    x += '\t</url>\n';
  });
  return x;
};

exports.run = function(filter: string) {
  const tiddlers = $tw.wiki.filterTiddlers(filter);
  const data = [];
  for (const tiddler_ of tiddlers) {
    const tiddler = $tw.wiki.getTiddler(tiddler_);
    if (tiddler) {
      const fields = {};
      for (const field in tiddler.fields) {
        fields[field] = escapify(tiddler.getFieldString(field));
      }
      data.push(fields);
    }
  }
  return stringify(data);
};
