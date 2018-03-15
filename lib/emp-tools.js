'use babel';

import { CompositeDisposable } from 'atom';
import {  initial, goto_file , goto_file_by_click} from './open-link.js';
import $ from 'jquery';

const click = 'click.efd-goto'
const klass = 'efd-goto-marker'
let links = [];

export default {

  subscriptions: null,

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'emp-tools:toggle': () => this.toggle()
    }));

    $('atom-workspace')
      .keydown(e => {
        e.keyCode === 91 && mark() })
      .keyup(e => { e.keyCode === 91 && unmark() })

    initial();
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  serialize() {
    return {

    };
  },

  toggle() {
    // console.log('EmpTools was toggled!');
    goto_file();
  }

};


const unmark = () => {
  links.forEach(link => {
    link.removeClass(klass)
    link.unbind(click)
  })
  links = []
}


const mark = () => {
  // console.log("do marks");
  let editor = atom.workspace.getActiveTextEditor()
  // let { isRunning, selectedApp } = store.getState()
  let filepath
  // let offline
  let attr

  if (editor) {
    $(editor.element)
      .find('span.syntax--entity.syntax--other.syntax--attribute-name.syntax--html')
      .each(function () {
        // console.log($(this));
        attr = $(this).text().trim()
        // console.log($(this), attr);
        if (attr === 'src' || attr === 'ref') {
          if ($(this).next().get(0)) {
            // if (/\.(lua|css)\s*['"]/.test($(this).next().text())) {
            let offline = $(this).next().text().match('[^\'"]+')
            // console.log("off:", offline);
            if (offline) {
              [offline] = offline
              // if (offline.includes('/')) {
              //   offline = join('channels', offline)
              // }
              // filepath = ap.offlineToAbsolute(offline, selectedApp)
              // if (fs.existsSync(filepath)) {
              links.push($(this).next())
              $(this).next().addClass(klass)
              $(this).next().bind(click, () => {
                // console.log(offline);
                goto_file_by_click(editor, offline)
                // atom.workspace.open(abspath)
              })
              // }
            }
          }
        }
      })
  }
}
