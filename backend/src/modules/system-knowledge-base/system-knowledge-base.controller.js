const { sendSuccess } = require("../../common/utils/response");
const fs=require("node:fs");
const service = require("./system-knowledge-base.service");
const {HTML_CSP,parseSingleRange}=require("./system-knowledge-base.preview");
const {buildInlineContentDisposition}=require("./system-knowledge-base.content");
async function listKnowledgeBases(req,res){return sendSuccess(res,await service.listKnowledgeBases());}
async function getKnowledgeBaseDetail(req,res){return sendSuccess(res,await service.getKnowledgeBaseDetail(Number(req.params.id)));}
async function createKnowledgeBase(req,res){return sendSuccess(res,await service.createKnowledgeBase(req.validatedBody,req.user),null,201);}
async function updateKnowledgeBase(req,res){return sendSuccess(res,await service.updateKnowledgeBase(Number(req.params.id),req.validatedBody));}
async function deleteKnowledgeBase(req,res){return sendSuccess(res,await service.deleteKnowledgeBase(Number(req.params.id)));}
async function uploadKnowledgeDocument(req,res){return sendSuccess(res,await service.uploadKnowledgeDocument(Number(req.params.id),req.file),null,201);}
async function reparseKnowledgeDocument(req,res){return sendSuccess(res,await service.reparseKnowledgeDocument(Number(req.params.documentId)));}
async function previewKnowledgeDocument(req,res){return sendSuccess(res,await service.getKnowledgeDocumentPreview(Number(req.params.documentId)));}
async function streamKnowledgeDocumentContent(req,res){
  const content=await service.resolveKnowledgeDocumentContent(Number(req.params.documentId),req.query.variant);
  res.setHeader("Content-Type",content.mimeType);
  res.setHeader("Content-Disposition",buildInlineContentDisposition(content.fileName));
  res.setHeader("Cache-Control","private, no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  if(content.mimeType.startsWith("text/html"))res.setHeader("Content-Security-Policy",HTML_CSP);
  if(content.mode==="text"){
    res.setHeader("Content-Length",Buffer.byteLength(content.content,"utf8"));
    return res.send(content.content);
  }
  res.setHeader("Accept-Ranges","bytes");
  const rangeHeader=req.headers.range;
  if(rangeHeader){
    const range=parseSingleRange(rangeHeader,content.size);
    if(!range){
      res.status(416).setHeader("Content-Range",`bytes */${content.size}`);
      return res.end();
    }
    const length=range.end-range.start+1;
    res.status(206);
    res.setHeader("Content-Range",`bytes ${range.start}-${range.end}/${content.size}`);
    res.setHeader("Content-Length",length);
    return fs.createReadStream(content.path,{start:range.start,end:range.end}).pipe(res);
  }
  res.setHeader("Content-Length",content.size);
  return fs.createReadStream(content.path).pipe(res);
}
async function downloadKnowledgeDocument(req,res){const document=await service.getKnowledgeDocumentById(Number(req.params.documentId));return res.download(document.filePath,document.fileName);}
async function deleteKnowledgeDocument(req,res){return sendSuccess(res,await service.deleteKnowledgeDocument(Number(req.params.documentId)));}
async function syncIncubationKnowledgeBase(req,res){return sendSuccess(res,await service.syncIncubationKnowledgeBase(Number(req.params.incubationId),req.validatedBody||{},req.user));}
module.exports={listKnowledgeBases,getKnowledgeBaseDetail,createKnowledgeBase,updateKnowledgeBase,deleteKnowledgeBase,uploadKnowledgeDocument,reparseKnowledgeDocument,previewKnowledgeDocument,streamKnowledgeDocumentContent,downloadKnowledgeDocument,deleteKnowledgeDocument,syncIncubationKnowledgeBase};
