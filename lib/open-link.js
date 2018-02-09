'use babel';

// import path from 'path';
import { existsSync } from 'fs';
import { join, relative, extname, dirname, basename, sep, resolve } from 'path';

import {EnableView } from './util/emp-link-file';
import {load_path, load_all_path, load_all_path_unignore, load_file_path_unignore, filter_path} from './util/path-loader';


var oEMPGOTOPathCatch = {};
var sEMPGOTOProject = "";
var sEMPGOTOURI = "";
var aFilterList = [];
var oEnableView = null;

const UNIGNORE_LIST = [".hg", ".git", "ebin", "bin", "admin"];
const EMP_WARN_TITLE = "文件不存在!";
const EMP_WARN_DESC = "没有找到外联文件, 请检查外联文件名是否正确,或者地址是否符合规范!"
const EMP_WARN_DETAIL = "文件地址:";

const EMP_ERR_TITLE = "文件不存在!";
const EMP_ERR_DESC = "没有找到对应离线资源的滤镜, 请检查工程结构是否正确,地址是否符合规范!";

const COMMON_PATH_V5 = 'public/www/ewp_offline_dev/common';
const COMMON_PATH_V4 = 'public/www/resource_dev/common';
const CHANNEL_PATH_V4 = 'public/www/resource_dev/common/channels';
const WWW_PATH = 'public/www';
const V4 = 4.0;
const V5 = 5.0;

export default {
  initial() {
    try {
      get_path();
    } catch (e) {
      console.error(e);
      console.error("emp tool initial fail!");
    }
  },


  goto_file() {
    // console.log('do jump~:');
    try {
      let editor = atom.workspace.getActiveTextEditor();
      sEMPGOTOURI = editor.getSelectedText() || get_text(editor);
      if (check_http(sEMPGOTOURI)){
        atom.workspace.open(sEMPGOTOURI)
      } else {
        let sExt = get_ext(editor);
        // console.log(sExt);
        if (sExt == "erl" || sExt == "hrl") {
          // console.log("link erl");
        } else {
          // console.log("link else");
          find_file(editor, sEMPGOTOURI);
        }
      }
    } catch (e) {
      console.error(e);
      console.error("goto file failed!!!");
      show_error()
    }

  },

  goto_file_by_click(oEditor, sUri) {
    filter_file(oEditor, sUri);
  }
}


let find_file = (oEditor, sUri) => {
  let iLine = oEditor.lineTextForBufferRow(oEditor.getCursorBufferPosition().row);
  if (iLine.includes('require')) {
    return resolve_file(oEditor, sUri, ['.js', '.coffee']);
  }
  if (iLine.includes('<link')) {
    return filter_file(oEditor, sUri, ['.css', '.less']);
  }
  if (iLine.includes('<script')) {
    return filter_file(oEditor, sUri, ['.js', '.lua']);
  }



}

let filter_file = (oEditor, sUri) => {
  let sTmpFile = oEditor.getPath();
  // console.log("sTmpFile:", sTmpFile);
  let sVer = detect_version_by_file(sTmpFile);
  sEMPGOTOProject = get_proj_by_version(sTmpFile, sVer);
  // console.log("goto proj:", sEMPGOTOProject);
  if (sVer == V5) {
    open_file_v5(sUri);
  } else if (sVer == V4) {
    open_file_v4(sUri);
  } else {
    if (sTmpFile.indexOf(WWW_PATH) > -1){
      sEMPGOTOProject = sTmpFile.split(WWW_PATH)[0];
      let sOffPathV5 = join(sEMPGOTOProject, COMMON_PATH_V5),
          sOffPathV4 = join(sEMPGOTOProject, COMMON_PATH_V4);
      let bFlagV5 = existsSync(sOffPathV5),
          bFlagV4 = existsSync(sOffPathV4);
      if (bFlagV5 && bFlagV4) {
        open_file_v5(sUri, open_file_v4)
      } else if (bFlagV5){ // 优先离线5
        open_file_v5(sUri)
      } else if (bFlagV4) {
        open_file_v4(sUri)
      } else {
        show_error();
      }
    } else {
      // console.log("else file");

      // let sUriName = basename(sUri);
      if (aFilterList.length > 0){
        open_finded_file();
        get_path();
      } else{
        get_path(open_finded_file);
      }
    }

  }

}

let get_path = (callback) => {
  load_path("./", UNIGNORE_LIST, (aRe) => {
    // console.log(aRe);
    aFilterList = aRe;
    if (callback) {
      callback()
    }
  })
}

let create_view = () => {
  if (!oEnableView) {
    oEnableView = new EnableView();
  }
  return oEnableView;
}

let open_finded_file = () => {
  let sUriName = basename(sEMPGOTOURI);
  let aFilterRe = filter_path(aFilterList, sUriName);
  // console.log("aFilterRe:", aFilterRe);
  if (aFilterRe.length == 1) {
    open_file([aFilterRe[0].dir]);
  } else if (aFilterRe.length > 1) {
    create_view().enable_view(aFilterRe, (sSeleFile) =>{
      open_file([sSeleFile]);
    });
  } else {
    show_error();
  }
}

let open_file_v5 = (sUri, callback) => {
  let sOpenFile = join(sEMPGOTOProject, COMMON_PATH_V5, sUri);
  // console.log("goto file:", sOpenFile);
  if (existsSync(sOpenFile)){
    open_file([sOpenFile]);
  } else {
    if (callback) {
      callback(sUri)
    } else {
      show_warning(sOpenFile);
    }
  }
}

let open_file_v4 = (sUri, callback) => {
  if (sUri.indexOf("/", 1) > -1) {
    let sOpenFile = join(sEMPGOTOProject, CHANNEL_PATH_V4, sUri);
    // console.log("goto file:", sOpenFile);
    if (existsSync(sOpenFile)){
      open_file([sOpenFile]);
    } else {
      if (callback) {
        callback(sUri)
      } else {
        show_warning(sOpenFile);
      }
    }
  } else {
    let sExt = get_ext_bn(sUri);
    let sOpenFile = join(sEMPGOTOProject, COMMON_PATH_V4, sExt, sUri);
    // console.log("goto file:", sOpenFile);
    if (existsSync(sOpenFile)){
      open_file([sOpenFile]);
    } else {
      show_warning(sOpenFile);
    }
  }
}


let get_text = (oEditor) => {
  let aCursor,
      sText = "" ,
      oRange;
  aCursor = oEditor.getCursors()[0];
  oRange = oEditor.displayBuffer.bufferRangeForScopeAtPosition('.string.quoted', aCursor.getBufferPosition());

  if (oRange) {
    sText = oEditor.getTextInBufferRange(oRange).slice(1, -1);
  } else {
    sText = oEditor.getWordUnderCursor({
      wordRegex: /[\/A-Z\.\-\d\\-_:]+(:\d+)?/i
    });
  }
  if (sText.slice(-1) === ':') {
    sText = sText.slice(0, -1);
  }
  // console.log(sText);
  return sText.trim();
}

let get_ext = (oEditor) => {
  let sTmpFile = oEditor.getPath();
  let sBaseName = basename(sTmpFile);
  let sExt = extname(sBaseName);
  sExt = sExt != null ? sExt.split(".") : void 0;
  sExt = (sExt != null ? sExt[1] : void 0) || "";
  return sExt
}

let get_ext_bn = (sTmpFile) => {
  let sBaseName = basename(sTmpFile);
  let sExt = extname(sBaseName);
  sExt = sExt != null ? sExt.split(".") : void 0;
  sExt = (sExt != null ? sExt[1] : void 0) || "";
  return sExt
}

let check_http = (sUri) => {
  if (sUri.indexOf('http:') === 0 || sUri.indexOf('https:') === 0 || sUri.indexOf('localhost:') === 0) {
    return true;
  } else {
    return false;
  }
};

let get_proj = (oEditor) => {
  let sProjPath = atom.project.getPaths()[0];
  let sTmpFile = oEditor.getPath();
  // console.log("sProjPath:", sProjPath, "   sTmpFile:", sTmpFile);
  if (sTmpFile.indexOf(sProjPath) > -1){
    // console.log("include :");
  } else {
    // console.log("un include :");
  }

}

const detect_version = (proj) => {
  // console.log("detectOfflineVersion:",join(proj, COMMON_PATH_V5));
  if (existsSync(join(proj, COMMON_PATH_V5))) {
    return V5
  } else if (existsSync(join(proj, COMMON_PATH_V4))) {
    return V4
  } else {
    return null
  }
}

const detect_version_by_file = (sFile) => {
  // console.log("detectOfflineVersion:",join(proj, COMMON_PATH_V5));
  if (sFile.indexOf(COMMON_PATH_V5) > -1){
    return V5;
  } else if (sFile.indexOf(COMMON_PATH_V4) > -1) {
    return V4;
  } else {
    return null;
  }
}

const get_proj_by_version = (sFile, sVer) => {
  let sProj = "";
  if (sVer == V5) {
    return sFile.split(COMMON_PATH_V5)[0]
  } else if ( sVer == V4 ) {
    return sFile.split(COMMON_PATH_V4)[0]
  } else {
    return atom.project.getPaths()[0];
  }
}

let open_file =(aUri) => {
  atom.workspace.open(aUri[0], []).then((oNewEditor) => {
    if (aUri[1]) {
      oNewEditor.setCursorScreenPosition(aUri[1]);
    }

    oEMPGOTOPathCatch[sEMPGOTOProject] = oEMPGOTOPathCatch[sEMPGOTOProject] || {};
    oEMPGOTOPathCatch[sEMPGOTOProject][sEMPGOTOURI] = aUri[0]
  }
  );

}

let show_warning = (sFile) =>{
  atom.notifications.addWarning(EMP_WARN_TITLE, {dismissable:false, description:EMP_WARN_DESC, detail:EMP_WARN_DETAIL+sFile});
}

let show_error = () =>{
  atom.notifications.addError(EMP_ERR_TITLE, {dismissable:false, description:EMP_ERR_DESC});
}
  //
  // get_text: (editor)->
  //   cursor = editor.getCursors()[0]
  //   range = editor.displayBuffer.bufferRangeForScopeAtPosition '.string.quoted',cursor.getBufferPosition()
  //   # console.log range
  //   # console.log editor.getWordUnderCursor wordRegex:/[\/A-Z\.\-\d\\-_:]+(:\d+)?/i
  //   if range
  //     text = editor.getTextInBufferRange(range)[1..-2]
  //   else
  //     text = editor.getWordUnderCursor wordRegex:/[\/A-Z\.\-\d\\-_:]+(:\d+)?/i
  //   # console.log text
  //   text = text[0..-2] if text.slice(-1) is ':'
  //   text.trim()
