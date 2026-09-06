import { messages } from './translations.js';

const supported=value=>value==='en'||value==='zh';
function initialLanguage(){
 const requested=new URL(location.href).searchParams.get('lang');
 return supported(requested)?requested:'en';
}
let language=initialLanguage();
export function t(key,values={}){
 const message=messages[language][key];
 if(message===undefined)throw new Error(`Missing translation: ${language}.${key}`);
 return message.replace(/\{(\w+)\}/g,(match,name)=>values[name]??match);
}
export function setText(element,key,values={}){
 if(!element)return;
 element.dataset.i18n=key;
 element.dataset.i18nVars=JSON.stringify(values);
 element.textContent=t(key,values);
}
export function setAttributeText(element,attribute,key,values={}){
 if(!element)return;
 element.setAttribute(`data-i18n-${attribute}`,key);
 element.dataset.i18nVars=JSON.stringify(values);
 element.setAttribute(attribute,t(key,values));
}
export function localize(root=document){
 const attributes=['aria-label','title','placeholder','alt','content'];
 const selector=['[data-i18n]',...attributes.map(a=>`[data-i18n-${a}]`)].join(',');
 const elements=[...(root.matches?.(selector)?[root]:[]),...root.querySelectorAll(selector)];
 for(const element of elements){
  const values=JSON.parse(element.dataset.i18nVars||'{}');
  if(element.dataset.i18n)element.textContent=t(element.dataset.i18n,values);
  for(const attribute of attributes){
   const key=element.getAttribute(`data-i18n-${attribute}`);
   if(key)element.setAttribute(attribute,t(key,values));
  }
 }
}
function syncLanguageControls(){
 document.documentElement.lang=language==='zh'?'zh-CN':'en';
 document.querySelectorAll('[data-language-toggle]').forEach(button=>{
  button.textContent=language==='zh'?'English':'中文';
  button.lang=language==='zh'?'en':'zh-CN';
  button.setAttribute('aria-label',language==='zh'?'Switch to English':'切换为中文');
  button.title=language==='zh'?'English version':'中文版';
 });
}
export function setLanguage(next){
 if(!supported(next))return;
 language=next;
 try{
  const url=new URL(location.href);
  url.searchParams.set('lang',language);
  history.replaceState(history.state,'',url);
 }catch{}
 localize();
 syncLanguageControls();
 document.dispatchEvent(new CustomEvent('languagechange',{detail:{language}}));
}
export function initLanguage(){
 localize();
 syncLanguageControls();
 document.addEventListener('click',event=>{
  if(event.target.closest('[data-language-toggle]'))setLanguage(language==='zh'?'en':'zh');
 });
}
