/* Test for $:/plugins/linonetwo/tw-server-sitemap/sitemapentries.js */
// This test assumes it runs in the TiddlyWiki5 test environment
// and that $tw is globally available.

describe('sitemapentries macro', function() {
  let sitemapentries;
  beforeAll(function() {
    sitemapentries = require('$:/plugins/linonetwo/tw-server-sitemap/sitemapentries.js');
  });

  it('should export the correct macro name', function() {
    expect(sitemapentries.name).toBe('sitemapentries');
  });

  it('should return correct XML for a simple tiddler', function() {
    // Mock $tw.wiki methods
    const filter = '[title[TestTiddler]]';
    const tiddlerFields = {
      title: 'TestTiddler',
      modified: '202507300000'
    };
    spyOn($tw.wiki, 'filterTiddlers').and.returnValue(['TestTiddler']);
    spyOn($tw.wiki, 'getTiddler').and.returnValue({
      fields: tiddlerFields,
      getFieldString: field => tiddlerFields[field]
    });
    spyOn($tw.wiki, 'getTiddlerText').and.callFake((title, def) => {
      if (title === '$:/plugins/linonetwo/tw-server-sitemap/configs/WebsiteURL') return 'https://example.com/';
      if (title === '$:/plugins/linonetwo/tw-server-sitemap/configs/UseHashVersion') return 'no';
      return def;
    });
    spyOn($tw.utils, 'formatDateString').and.returnValue('2025-07-30');
    spyOn($tw.utils, 'parseDate').and.returnValue(new Date('2025-07-30'));

    const xml = sitemapentries.run(filter);
    expect(xml).toContain('<loc>https://example.com/TestTiddler</loc>');
    expect(xml).toContain('<lastmod>2025-07-30</lastmod>');
    expect(xml).toContain('<changefreq>monthly</changefreq>');
    expect(xml).toContain('<priority>0.5</priority>');
  });
});
