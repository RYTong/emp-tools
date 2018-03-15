'use babel';

// import path from 'path';
import {Point, Range} from 'atom';
import { existsSync, readFileSync, readdirSync} from 'fs';
import { join, relative, extname, dirname, basename, sep, resolve } from 'path';

import {EnableView } from './util/emp-link-file';
import {load_path, load_all_path, load_all_path_unignore, load_file_path_unignore, filter_path} from './util/path-loader';
import $ from 'jquery';

import {parse as head_parse} from './head-parser/lib/parser';
import _ from 'underscore-plus';

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

const P_TYPE_CSS = "link";
const P_TYPE_LUA = "script-src";
const P_TYPE_CSS_LINK = "ref";
const P_TYPE_LUA_LINK = "src";

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
      // console.log("sEMPGOTOURI:",sEMPGOTOURI);
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
      show_warning()
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

  let sType = sUri.match(/[.:()]/ig)? "lua":"css";
  find_next(oEditor, sUri, sType);
}

let find_next = (oEditor, sUri, sType) => {
  // console.log(sUri, sType);
  let aNewArr = [];
  let sText = oEditor.getText();
  // let aRe = sText.match( /<head>[\s\S]*?<\/head>/g);
  // console.log(aRe);
  sUri = get_css(oEditor, sUri);
  if (sType == "css") {
    sUri = "."+sUri;
    if (!find_in_style(oEditor, sUri, sType)){
      // console.log("not in style");
      find_in_link(oEditor, sUri, sType);
    }

  } else {
    if (sUri.includes("(")){
      sUri = sUri.split("(")[0].trim();
    }
    if (sUri.includes(".")){
      sUri = sUri.split(".")[1].trim();
    }
    sUri = new RegExp("function\\s*"+sUri, "ig");
    if (!find_in_script(oEditor, sUri, sType)){
      // console.log("not in script");
      find_in_link(oEditor, sUri, sType);
    }
    // let aRe = sText.match(/<!\[CDATA\[[\s\S]*\]\]/g);

  }
}

let find_in_script = (oEditor, sUri, sType) =>{
  let sText = oEditor.getText();
   let aRe = sText.match(/<!\[CDATA\[[\s\S]*\]\]/g);
   // console.log(aRe, sUri, "funciton\\s*"+sUri);
   // let oReg = new RegExp("function\\s*"+sUri, "ig");
   // console.log(oReg);
   if (aRe) {
     for (let i =0; i < aRe.length; i ++) {
       if (aRe[i].match(sUri)){
         let sPreText = sText.split(aRe[i])[0];
         let sStyleText = aRe[i].split(sUri)[0];
         let sReText = sPreText + sStyleText;
         let aTmpText = sReText.split(/\n/ig);
         console.log(aTmpText.length);
         oEditor.setCursorBufferPosition([aTmpText.length-1, 0]);
         return true;
         break;
       }
     }
   }
   return false;
}
let find_in_style = (oEditor, sUri, sType) =>{
  let sText = oEditor.getText();
  let aRe = sText.match( /<style>[\s\S]*?<\/style>/g);

  // console.log("sUri----:",sUri);
  // oRange = oEditor.displayBuffer.bufferRangeForScopeAtPosition('.string.quoted', aCursor.getBufferPosition());
  if (aRe) {
    for (let i =0; i < aRe.length; i ++) {
      if (aRe[i].match(sUri)){
        // console.log("exist -------");
        let sPreText = sText.split(aRe[i])[0];
        let sStyleText = aRe[i].split(sUri)[0];
        // console.log(sStyleText, "."+sUri);
        let sReText = sPreText + sStyleText;
        let aTmpText = sReText.split(/\n/ig);
        oEditor.setCursorScreenPosition([aTmpText.length, 0]);
        return true;
        break;
      }
    }
  }
  return false;
}

let get_css = (oEditor, sUri) => {
  if (sUri.includes("\,")){
    // console.log(" exist ,,,,,,");
    let aCursor = oEditor.getCursors()[0];
    let aCursorRange = aCursor.getBufferPosition();
    let oRange = oEditor.displayBuffer.bufferRangeForScopeAtPosition('.string.quoted', aCursor.getBufferPosition());
    let iStart = oRange.start.column;
    let iStop = oRange.end.column;
    let iCusor = aCursorRange.column;
    let aRe = sUri.split("\,");
    // console.log(iStart, iStop, iCusor);
    for (let i =0; i< aRe.length; i++){
      // console.log(i, aRe[i], aRe[i].length, iStart, iCusor);
      iStart = iStart+aRe[i].length+1;
      if (iStart >= iCusor){
        // console.log(aRe[i]);
        sUri = aRe[i];
        break;
      }
    }
    return sUri;
  } else {
    return sUri;
  }
}



let parse_head_file = (oEditor, sUri, sType) =>{
  // console.log(sUri, sType);
  let aNewArr = [];
  let sText = oEditor.getText();
  let aRe = sText.match( /<head>[\s\S]*?<\/head>/g);
  // console.log(aRe);
  if (aRe) {
    // console.log("do parse-----");
    let aParseRe = head_parse(aRe[0]);
    // console.log(aParseRe);
    if (sType == "css") {
      aParseRe.forEach(function (oObj){
        // console.log(oObj);
        if (oObj.type == P_TYPE_CSS){
          let aProps = oObj.props;
          let sStore_link = "";
          for (let i=0; i < aProps.length; i++){
            if (aProps[i].key === P_TYPE_CSS_LINK){
              aNewArr.unshift(aProps[i].value);
              break;
            }
          }
        }
      });
    } else {
      aParseRe.forEach(function (oObj){
        // console.log(oObj);
        if (oObj.type == P_TYPE_LUA){
          let aProps = oObj.props;
          let sStore_link = "";
          for (let i=0; i < aProps.length; i++){
            if (aProps[i].key === P_TYPE_LUA_LINK){
              aNewArr.unshift(aProps[i].value);
              break;
            }
          }
        }
      });
    }
  }
  // console.log(aNewArr);
  return aNewArr;
}

let find_in_link = (oEditor, sUri, sType) => {
  let aFileList = parse_head_file(oEditor, sUri, sType);
  console.log(aFileList, sUri);
  let sFilePath = dirname(oEditor.getPath());
  // console.log(sFilePath);
  let sVer = V4;
  if (sFilePath.indexOf(COMMON_PATH_V5) > -1){
    sVer = V5;
  } else if (sFilePath.indexOf(COMMON_PATH_V4) > -1) {
    sVer = V4;
  } else {
    if (sFilePath.indexOf(WWW_PATH) > -1){
      let sTmpDirName = sFilePath.split(WWW_PATH)[0];
      let sTmpDirNameV5 = join(sTmpDirName, COMMON_PATH_V5);
      let sTmpDirNameV4 = join(sTmpDirName, COMMON_PATH_V4);
      if (existsSync(sTmpDirNameV5)){
        sVer = V5;
      } else if (existsSync(sTmpDirNameV4)){
        sVer = V4;
      }else {
        // throw("error project path!");
        show_warning();
        return;
      }
    }else {
      show_warning()
      // throw("error project path!");
      return;
    }
  }

  sEMPGOTOProject = get_proj_by_version(sFilePath, sVer);
  // console.log("project is :", sEMPGOTOProject, sVer);
  if (sVer == V5) {
    // console.log(" do v5", aFileList);
    for (let i=0; i< aFileList.length; i++){
      let sTmpFilePath = join(sEMPGOTOProject, COMMON_PATH_V5, aFileList[i]);
      // console.log("sTmpFilePath:",sTmpFilePath);
      if (existsSync(sTmpFilePath)){
        // console.log("exist:",sTmpFilePath);
        let sContent = readFileSync(sTmpFilePath, "utf-8");
        // console.log(sUri, sContent.match(sUri));
        if (sContent.match(sUri)){
          open_file_and_goto_position(sTmpFilePath, sUri);
          return;

        }
      }
    }
    read_from_common(V5, sEMPGOTOProject, sUri, sType);

  } else if (sVer == V4) {
    // console.log(" do v4");
    for (let i=0; i< aFileList.length; i++){
      if (aFileList[i].indexOf("/", 1) > -1) {
        let sTmpFilePath = join(sEMPGOTOProject, CHANNEL_PATH_V4, aFileList[i]);
        if (existsSync(sTmpFilePath)){
          let sContent = readFileSync(sTmpFilePath, "utf-8");
          if (sContent.match(sUri)){
            open_file_and_goto_position(sTmpFilePath, sUri);
            return;
          }
        }
      } else {
        let sExt = get_ext_bn(aFileList[i]);
        let sTmpFilePath = join(sEMPGOTOProject, COMMON_PATH_V4, sExt, aFileList[i]);
        if (existsSync(sTmpFilePath)){
          let sContent = readFileSync(sTmpFilePath, "utf-8");
          if (sContent.match(sUri)){
            open_file_and_goto_position(sTmpFilePath, sUri);
            return;
          }
        }
      }
    }
    // console.log("read from common");
    read_from_common(V4, sEMPGOTOProject, sUri, sType);
  } else {
    show_warning();
    return;
    // throw("error project path!");
  }
}

let read_from_common = (sVer, sEMPGOTOProject, sUri, sType) =>{
  let aFileList = [];
  let sTmpDirPath = "";
  if (sVer == V5) {
    sTmpDirPath = join(sEMPGOTOProject, COMMON_PATH_V5, sType)
  } else {
    sTmpDirPath = join(sEMPGOTOProject, COMMON_PATH_V4, sType)
  }
  // console.log(sTmpDirPath);
  if (existsSync(sTmpDirPath)){
    aFileList = readdirSync(sTmpDirPath).map((sFileName)=>{
      return join(sTmpDirPath, sFileName)
    });
  }
  console.log("find in :", aFileList);
  for (let i=0; i< aFileList.length; i++){
    if (existsSync(aFileList[i])){
      // console.log("exist:",aV5FileList[i]);
      let sContent = readFileSync(aFileList[i], "utf-8");
      // console.log(sUri, sContent.match(sUri));
      console.log(sUri);
      if (sContent.match(sUri)){
        open_file_and_goto_position(aFileList[i], sUri);
        return;
      }
    }
  }
  show_warning();
  return;
  // throw("not finded!")
}

let open_file_and_goto_position = (sFile, sUri) =>{
  console.log("goto file:",sFile);
  atom.workspace.open(sFile, []).then((oNewEditor) => {
    let regex = sUri
    if (typeof(sUri) == 'string'){
      let expression = _.escapeRegExp(sUri);
      regex = new RegExp(expression, 'ig');
    }
    let newMarkers = []
    oNewEditor.scanInBufferRange(regex, Range(Point.ZERO, Point.INFINITY), ({range}) =>{
        createMarker(range, oNewEditor);
        oNewEditor.setCursorBufferPosition(range.start);
      }
    )
  }
  );
}

let createMarker = (range, tmp_editor) =>{
  tmp_editor.markBufferRange(range,
    {invalidate: 'inside',
    persistent: false,
    maintainHistory: false}
  )
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
        show_warning();
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
    show_warning();
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

  // console.log(oRange, aCursor.getBufferPosition());
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
