'use babel';

import { CompositeDisposable } from 'atom';
import {  jump_to_file } from './open-link.js';
var jctest =2;

export default {

  subscriptions: null,

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'emp-tools:toggle': () => this.toggle()
    }));
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  serialize() {
    return {

    };
  },

  toggle() {
    console.log('EmpTools was toggled!');

    jump_to_file();
  }

};
