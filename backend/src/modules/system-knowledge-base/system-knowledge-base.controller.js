const { sendSuccess } = require("../../common/utils/response");
const service = require("./system-knowledge-base.service");
async function listKnowledgeBases(req,res){return sendSuccess(res,await service.listKnowledgeBases());}
async function getKnowledgeBaseDetail(req,res){return sendSuccess(res,await service.getKnowledgeBaseDetail(Number(req.params.id)));}
async function createKnowledgeBase(req,res){return sendSuccess(res,await service.createKnowledgeBase(req.validatedBody,req.user),null,201);}
async function updateKnowledgeBase(req,res){return sendSuccess(res,await service.updateKnowledgeBase(Number(req.params.id),req.validatedBody));}
async function deleteKnowledgeBase(req,res){return sendSuccess(res,await service.deleteKnowledgeBase(Number(req.params.id)));}
async function uploadKnowledgeDocument(req,res){return sendSuccess(res,await service.uploadKnowledgeDocument(Number(req.params.id),req.file),null,201);}
async function reparseKnowledgeDocument(req,res){return sendSuccess(res,await service.reparseKnowledgeDocument(Number(req.params.documentId)));}
async function previewKnowledgeDocument(req,res){return sendSuccess(res,await service.getKnowledgeDocumentPreview(Number(req.params.documentId)));}
async function downloadKnowledgeDocument(req,res){const document=await service.getKnowledgeDocumentById(Number(req.params.documentId));return res.download(document.filePath,document.fileName);}
async function deleteKnowledgeDocument(req,res){return sendSuccess(res,await service.deleteKnowledgeDocument(Number(req.params.documentId)));}
async function syncIncubationKnowledgeBase(req,res){return sendSuccess(res,await service.syncIncubationKnowledgeBase(Number(req.params.incubationId),req.validatedBody||{},req.user));}
module.exports={listKnowledgeBases,getKnowledgeBaseDetail,createKnowledgeBase,updateKnowledgeBase,deleteKnowledgeBase,uploadKnowledgeDocument,reparseKnowledgeDocument,previewKnowledgeDocument,downloadKnowledgeDocument,deleteKnowledgeDocument,syncIncubationKnowledgeBase};
