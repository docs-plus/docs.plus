'use strict';

const path = require('path');
const eejs = require('../../eejs');
const fs = require('fs');
const fsp = fs.promises;
const toolbar = require('../../utils/toolbar');
const hooks = require('../../../static/js/pluginfw/hooks');
const settings = require('../../utils/Settings');
const util = require('util');
const webaccess = require('./webaccess');
const padInfo = require('../../utils/nestedPad'); // @Hossein
const db = require("../../db/DB");  // @Samir
const minify = require('../../utils/Minify'); // @Hossein

exports.expressCreateServer = (hookName, args, cb) => {
  // expose current stats
  args.app.get('/stats', (req, res) => {
    res.json(require('../../stats').toJSON());
  });

  // @Hossein
  args.app.get(/(\/static\/plugins\/(.*))/ , (req, res, next) => {
    const path = req.path.split("/");
    const startPath = path.findIndex(path => path === "plugins");
    const newPath = path.slice(startPath, path.length).join("/");
    req.params.filename = newPath;
    return minify.minify(req, res);
  });

  // serve index.html under /
  args.app.get('/', (req, res) => {
    res.send(eejs.require('ep_etherpad-lite/templates/index.html', {req}));
  });

  // serve javascript.html
  args.app.get('/javascript', (req, res) => {
    res.send(eejs.require('ep_etherpad-lite/templates/javascript.html', {req}));
  });


  // serve robots.txt
  args.app.get('/robots.txt', (req, res) => {
    let filePath = path.join(
        settings.root,
        'src',
        'static',
        'skins',
        settings.skinName,
        'robots.txt'
    );
    res.sendFile(filePath, (err) => {
      // there is no custom robots.txt, send the default robots.txt which dissallows all
      if (err) {
        filePath = path.join(settings.root, 'src', 'static', 'robots.txt');
        res.sendFile(filePath);
      }
    });
  });

  // @Hossein
  // serve timeslider.html under /p/$padname/timeslider
  args.app.get('/p/:pad*/timeslider', async (req, res, next) => {
    const {padId, padName, padView} = padInfo(req);
    const staticRootAddress = req.path.split("/")
    .filter(x=> x.length)
    .map(path => "../")
    .join("");

    hooks.callAll('padInitToolbar', {
      toolbar,
    });
    // @Samir Sayyad Added for social preview
    const pad_title = await db.get("title:"+ padId);
    res.send(eejs.require('ep_etherpad-lite/templates/timeslider.html', {
      meta : { title : (pad_title) ? pad_title : req.params.pad },
      req,
      toolbar,
      padId,
      padView,
      padName,
      staticRootAddress,
    }));
  });
  // @Hossein
  // serve pad.html under /p
  args.app.get('/p/:pad*', async (req, res, next) => {
    let staticRootAddress = req.path.split("/");
    // The below might break for pads being rewritten
    const isReadOnly = !webaccess.userCanModify(req.params.pad, req);
    let {padId, padName, padView} = padInfo(req, isReadOnly);

    staticRootAddress = req.path.split("/")
      .filter(x=> x.length)
      .map(path => "../")
      .join("");

    hooks.callAll('padInitToolbar', {
      toolbar,
      isReadOnly,
    });

    // @Samir Sayyad Added for social preview
    // can be removed when require-kernel is dropped
    res.header('Feature-Policy', 'sync-xhr \'self\'');
    // @Samir Sayyad Added for social preview
    const pad_title = await db.get("title:"+ padId);

    // can be removed when require-kernel is dropped
    res.header('Feature-Policy', 'sync-xhr \'self\'');
    res.send(eejs.require('ep_etherpad-lite/templates/pad.html', {
      meta : { title : (pad_title) ? pad_title : req.params.pad },
      padId,
      padView,
      padName,
      staticRootAddress,
      req,
      toolbar,
      isReadOnly,
    }));
  });

  args.app.get(/\/favicon.ico$/, (req, res, next) =>
    (async () => {
      const fns = [
        ...(settings.favicon ? [path.resolve(settings.root, settings.favicon)] : []),
        path.join(settings.root, 'src', 'static', 'skins', settings.skinName, 'favicon.ico'),
        path.join(settings.root, 'src', 'static', 'favicon.ico'),
      ];
      for (const fn of fns) {
        try {
          await fsp.access(fn, fs.constants.R_OK);
        } catch (err) {
          continue;
        }
        res.setHeader('Cache-Control', `public, max-age=${settings.maxAge}`);
        await util.promisify(res.sendFile.bind(res))(fn);
        return;
      }
      next();
    })().catch((err) => next(err || new Error(err))));


  return cb();
};
