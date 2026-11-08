import {createHash} from 'node:crypto';import {Router} from 'express';import multer from 'multer';import pdfParse from 'pdf-parse';import {v2 as cloudinary} from 'cloudinary';import {Readable} from 'node:stream';import {protect,allowRoles} from '../middleware/auth.js';import {BrandRule,Document,Submission,AuditEvent,User,WorkspaceState} from '../models/index.js';import {scanBrandContent} from '../services/scanner.js';
const router=Router();router.use(protect);

// The existing React application uses synchronous localStorage stores. This
// authenticated workspace snapshot keeps those mature workflows persistent
// and shared across the same organization while the UI is migrated module by module.
const WORKSPACE_KEYS = new Set([
  'bg_creator_documents_v1','bg_creator_scans_v1','bg_creator_submissions_v1',
  'bg_review_comments_v1','bg_review_decisions_v1','bg_legal_decisions_v1',
  'bg_critical_overrides_v1','bg_audit_events_v1','bg_knowledge_base_v1',
  'bg_knowledge_versions_v1','bg_notification_reads_v1','bg_settings_v1'
]);
const organizationKey = req => String(req.user.organization || 'default').trim().toLowerCase();
const contentHash = value => createHash('sha256').update(String(value||'')).digest('hex');
router.get('/workspace', async (req,res,next) => {
  try {
    const org=organizationKey(req);
    await WorkspaceState.updateOne({organization:org,version:{$exists:false}},{$set:{version:0}});
    const state=await WorkspaceState.findOne({organization:org}).lean();
    res.json({data:state?.data||{},version:state?.version??0,updatedAt:state?.updatedAt||null});
  }catch(e){next(e);}
});
router.put('/workspace', async (req,res,next) => {
  try {
    const incoming=req.body?.data;
    const expectedVersion=Number(req.body?.version);
    if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))return res.status(400).json({message:'Workspace data must be an object.'});
    if(!Number.isInteger(expectedVersion)||expectedVersion<0)return res.status(400).json({message:'A valid workspace version is required. Reload the workspace and retry.'});
    const org=organizationKey(req);
    const existing=await WorkspaceState.findOne({organization:org}).lean();
    const currentVersion=existing?.version??0;
    if(currentVersion!==expectedVersion)return res.status(409).json({message:'Workspace changed in another session. Reload the latest workspace before saving.',version:currentVersion});
    const data={...(existing?.data||{}),...Object.fromEntries(Object.entries(incoming).filter(([key])=>WORKSPACE_KEYS.has(key)))};
    const oldData=existing?.data||{};
    const oldDocs=oldData.bg_creator_documents_v1||[];
    const oldSubs=oldData.bg_creator_submissions_v1||[];
    const incomingDocs=data.bg_creator_documents_v1||[];
    const incomingSubs=data.bg_creator_submissions_v1||[];

    // Only Admin may change knowledge-base/settings data; no role can overwrite keys it does not own.
    const editableKeys={
      Creator:new Set(['bg_creator_documents_v1','bg_creator_scans_v1','bg_creator_submissions_v1','bg_review_comments_v1','bg_audit_events_v1','bg_notification_reads_v1']),
      Reviewer:new Set(['bg_creator_documents_v1','bg_creator_submissions_v1','bg_review_comments_v1','bg_review_decisions_v1','bg_critical_overrides_v1','bg_audit_events_v1','bg_notification_reads_v1']),
      Legal:new Set(['bg_creator_documents_v1','bg_creator_submissions_v1','bg_review_comments_v1','bg_legal_decisions_v1','bg_critical_overrides_v1','bg_audit_events_v1','bg_notification_reads_v1']),
      Admin:new Set(['bg_knowledge_base_v1','bg_knowledge_versions_v1','bg_settings_v1','bg_notification_reads_v1'])
    }[req.user.role]||new Set();
    for(const key of WORKSPACE_KEYS)if(!editableKeys.has(key))data[key]=oldData[key]??(['bg_knowledge_base_v1','bg_settings_v1'].includes(key)?{}:[]);

    // Creator may only change their own documents and can only resubmit a returned submission.
    if(req.user.role==='Creator'){
      const safeDocs=incomingDocs.filter(d=>!oldDocs.some(o=>o.id===d.id)||oldDocs.some(o=>o.id===d.id&&o.creatorId===req.user.email)).map(d=>{
        const old=oldDocs.find(o=>o.id===d.id);
        if(!old)return {...d,status:'Draft',creatorId:req.user.email};
        if(old.creatorId!==req.user.email)return old;
        if(!['Draft','Changes Requested'].includes(old.status))return old;
        const safe={...d};
        for(const key of ['status','reviewerId','reviewerName','approvedAt','approvedVersion','publicationStatus','publishedAt','publishedBy','reviewDecision','legalStatus','legalReviewerId','legalReviewerName','legalReviewedAt','legalComment'])safe[key]=old[key];
        return safe;
      });
      data.bg_creator_documents_v1=[...safeDocs,...oldDocs.filter(o=>o.creatorId!==req.user.email&&!safeDocs.some(d=>d.id===o.id))];
      const safeSubs=[];
      for(const sub of incomingSubs){
        const old=oldSubs.find(o=>o.id===sub.id);
        if(!old){
          const localDoc=incomingDocs.find(d=>d.id===sub.documentId)||oldDocs.find(d=>d.id===sub.documentId);
          if(!localDoc||localDoc.creatorId!==req.user.email||!localDoc.backendId)continue;
          const backendDoc=await Document.findOne({_id:localDoc.backendId,creator:req.user._id,organization:org}).select('_id title content status scanResults').lean();
          if(!backendDoc)continue;
          const serverSubmission=await Submission.findOne({document:backendDoc._id,creator:req.user._id,organization:org,status:'In Review'}).sort({submittedAt:-1}).select('_id issues complianceScore submittedAt').lean();
          if(serverSubmission){
            const localIndex=data.bg_creator_documents_v1.findIndex(d=>d.id===localDoc.id);
            if(localIndex>=0)data.bg_creator_documents_v1[localIndex]={...data.bg_creator_documents_v1[localIndex],title:backendDoc.title,content:backendDoc.content,scanResults:backendDoc.scanResults,status:'In Review'};
            safeSubs.push({...sub,status:'In Review',creatorId:req.user.email,reviewerId:null,reviewerName:null,issues:serverSubmission.issues||[],complianceScore:serverSubmission.complianceScore,submittedAt:serverSubmission.submittedAt||sub.submittedAt});
          }
          continue;
        }
        if(old.creatorId!==req.user.email){safeSubs.push(old);continue;}
        safeSubs.push(old.status==='Changes Requested'&&sub.status==='Resubmitted'?{...old,status:'Resubmitted',resubmittedAt:sub.resubmittedAt}:old);
      }
      data.bg_creator_submissions_v1=[...safeSubs,...oldSubs.filter(o=>o.creatorId!==req.user.email&&!safeSubs.some(x=>x.id===o.id))];
      data.bg_creator_documents_v1=data.bg_creator_documents_v1.map(doc=>{
        const ownSubmission=data.bg_creator_submissions_v1.find(sub=>sub.documentId===doc.id&&sub.creatorId===req.user.email);
        return ownSubmission&&['In Review','Resubmitted'].includes(ownSubmission.status)?{...doc,status:'In Review'}:doc;
      });
    }

    // Reviewer/Legal decisions are accepted only as valid one-way state transitions.
    if(['Reviewer','Legal'].includes(req.user.role)){
      const allowedTransitions=req.user.role==='Reviewer'
        ? {'In Review':['Approved','Changes Requested','In Legal Review'],'Submitted':['Approved','Changes Requested','In Legal Review'],'Approved':['Published']}
        : {'In Legal Review':['In Review','Changes Requested','Rejected']};
      const safeSubs=incomingSubs.map(candidate=>{
        const old=oldSubs.find(x=>x.id===candidate.id);
        if(!old)return null;
        const next=candidate.status;
        const allowed=(allowedTransitions[old.status]||[]).includes(next);
        if(!allowed)return old;
        if(req.user.role==='Reviewer'&&next==='Changes Requested'&&!String(candidate.reviewComment||'').trim())return old;
        if(req.user.role==='Reviewer'&&next==='In Legal Review'&&!String(candidate.legalReason||'').trim())return old;
        if(req.user.role==='Legal'&&['Changes Requested','Rejected'].includes(next)&&!String(candidate.legalComment||'').trim())return old;
        if(req.user.role==='Reviewer'&&next==='Approved'){
          const unresolved=(old.issues||[]).filter(i=>i.severity==='Critical'&&!['Resolved','Dismissed'].includes(i.status));
          const overrides=oldData.bg_critical_overrides_v1||[];
          if(unresolved.some(i=>!overrides.some(o=>o.submissionId===old.id&&o.issueId===i.id&&String(o.reason||'').trim())))return old;
        }
        if(req.user.role==='Legal'&&next==='In Review'){
          const unresolved=(old.issues||[]).filter(i=>i.severity==='Critical'&&!['Resolved','Dismissed'].includes(i.status));
          const overrides=oldData.bg_critical_overrides_v1||[];
          if(unresolved.some(i=>!overrides.some(o=>o.submissionId===old.id&&o.issueId===i.id&&String(o.reason||'').trim())))return old;
        }
        const allowedFields=req.user.role==='Reviewer'
          ? ['reviewerId','reviewerName','reviewedAt','reviewComment','legalRequestedBy','legalRequestedAt','legalReason','publicationStatus','publishedAt','publishedBy']
          : ['legalStatus','legalReviewerId','legalReviewerName','legalReviewedAt','legalComment'];
        const safe={...old,status:next};
        for(const field of allowedFields)if(field in candidate)safe[field]=candidate[field];
        if(req.user.role==='Reviewer'){
          safe.reviewerId=req.user.email;safe.reviewerName=req.user.name;
          if(next==='In Legal Review'){safe.legalRequestedBy=req.user.name;safe.legalRequestedAt=new Date().toISOString();}
          if(['Approved','Changes Requested'].includes(next))safe.reviewedAt=new Date().toISOString();
        }else{
          safe.legalReviewerId=req.user.email;safe.legalReviewerName=req.user.name;safe.legalReviewedAt=new Date().toISOString();
        }
        return safe;
      }).filter(Boolean);
      data.bg_creator_submissions_v1=[...safeSubs,...oldSubs.filter(o=>!safeSubs.some(x=>x.id===o.id))];

      // Documents can receive workflow metadata only; their content and ownership remain immutable to reviewers.
      const workflowDocs=incomingDocs.map(candidate=>{
        const old=oldDocs.find(x=>x.id===candidate.id);if(!old)return null;
        const sub=data.bg_creator_submissions_v1.find(x=>x.documentId===old.id);
        const priorSub=oldSubs.find(x=>x.documentId===old.id&&x.id===sub?.id);
        const nextStatus=sub?.status||old.status;
        const valid=sub&&priorSub&&(allowedTransitions[priorSub.status]||[]).includes(nextStatus);
        if(!valid)return old;
        const workflowDoc={...old,status:nextStatus};
        if(req.user.role==='Reviewer'){
          workflowDoc.reviewerId=req.user.email;workflowDoc.reviewerName=req.user.name;
          if(nextStatus==='Approved'){workflowDoc.approvedAt=candidate.approvedAt||new Date().toISOString();workflowDoc.approvedVersion=old.version;workflowDoc.publicationStatus=candidate.publicationStatus||'Not published';}
          if(nextStatus==='Published'){workflowDoc.publicationStatus='Published';workflowDoc.publishedAt=candidate.publishedAt||new Date().toISOString();workflowDoc.publishedBy=req.user.name;}
          if(nextStatus==='Changes Requested')workflowDoc.changesRequestedReason=candidate.changesRequestedReason||'';
          if(nextStatus==='In Legal Review')workflowDoc.legalReason=candidate.legalReason||'';
        }else{
          workflowDoc.legalReviewerId=req.user.email;workflowDoc.legalReviewerName=req.user.name;
          workflowDoc.legalStatus=candidate.legalStatus||'Approved';workflowDoc.legalReviewedAt=new Date().toISOString();workflowDoc.legalComment=candidate.legalComment||'';
        }
        return workflowDoc;
      }).filter(Boolean);
      data.bg_creator_documents_v1=[...workflowDocs,...oldDocs.filter(old=>!workflowDocs.some(doc=>doc.id===old.id))];
    }

    // Decisions and overrides are append-only, role-attributed, and validated against the live submission.
    for(const key of ['bg_review_decisions_v1','bg_legal_decisions_v1','bg_critical_overrides_v1','bg_audit_events_v1']){
      const previous=oldData[key]||[], previousIds=new Set(previous.map(x=>x.id));
      let additions=(data[key]||[]).filter(x=>x?.id&&!previousIds.has(x.id));
      if(key==='bg_review_decisions_v1')additions=req.user.role==='Reviewer'?additions.filter(x=>
        ['Approved','Changes Requested'].includes(x.decision)&&data.bg_creator_submissions_v1.some(sub=>sub.id===x.submissionId&&sub.status===x.decision)
      ): [];
      if(key==='bg_legal_decisions_v1')additions=req.user.role==='Legal'?additions.filter(x=>
        ['Approved','Changes Requested','Rejected'].includes(x.decision)&&data.bg_creator_submissions_v1.some(sub=>sub.id===x.submissionId&&sub.legalStatus===x.decision)
      ): [];
      if(key==='bg_critical_overrides_v1')additions=['Reviewer','Legal'].includes(req.user.role)?additions.filter(x=>{
        const sub=data.bg_creator_submissions_v1.find(s=>s.id===x.submissionId);
        const active=req.user.role==='Reviewer'?['In Review','Submitted'].includes(sub?.status):sub?.status==='In Legal Review';
        const critical=(sub?.issues||[]).some(i=>i.id===x.issueId&&i.severity==='Critical');
        return active&&critical&&String(x.reason||'').trim().length>0;
      }):[];
      additions=additions.map(x=>({...x,actorId:req.user.email,actorName:req.user.name,role:req.user.role}));
      if(key==='bg_audit_events_v1')additions=additions.map(x=>({...x,userId:req.user.email,userName:req.user.name,role:req.user.role}));
      data[key]=[...additions,...previous];
    }
    // Comments are append-only except author edits; only Reviewer/Legal can resolve threads.
    const previousComments=oldData.bg_review_comments_v1||[];
    const comments=(data.bg_review_comments_v1||[]).filter(x=>x?.id).map(x=>{
      const old=previousComments.find(o=>o.id===x.id);
      if(!old)return {...x,authorId:req.user.email,authorName:req.user.name,role:req.user.role};
      if(old.authorId===req.user.email)return {...old,body:x.body??old.body,updatedAt:x.updatedAt??old.updatedAt};
      if(['Reviewer','Legal'].includes(req.user.role))return {...old,resolved:!!x.resolved,resolvedAt:x.resolvedAt,resolvedBy:req.user.name};
      return old;
    });
    data.bg_review_comments_v1=[...comments,...previousComments.filter(x=>!comments.some(c=>c.id===x.id))];

    // Optimistic concurrency prevents an old tab from replacing a newer shared snapshot.
    if(!existing){
      if(expectedVersion!==0)return res.status(409).json({message:'Workspace was created in another session. Reload before saving.',version:0});
      const created=await WorkspaceState.create({organization:org,data,updatedBy:req.user._id,version:1});
      return res.json({saved:true,version:created.version,updatedAt:created.updatedAt});
    }
    const saved=await WorkspaceState.findOneAndUpdate(
      {organization:org,version:expectedVersion},
      {$set:{data,updatedBy:req.user._id},$inc:{version:1}},
      {new:true}
    );
    if(!saved){const latest=await WorkspaceState.findOne({organization:org}).select('version').lean();return res.status(409).json({message:'Workspace changed in another session. Reload the latest workspace before saving.',version:latest?.version??expectedVersion+1});}
    // Keep the authoritative Mongo workflow in step with validated legacy-workspace decisions.
    const localDocs=data.bg_creator_documents_v1||[];
    for(const sub of data.bg_creator_submissions_v1||[]){
      const previous=oldSubs.find(item=>item.id===sub.id);
      if(!previous||previous.status===sub.status||sub.status==='Resubmitted')continue;
      const localDoc=localDocs.find(item=>item.id===sub.documentId);
      if(!localDoc?.backendId)continue;
      const backendDoc=await Document.findOne({_id:localDoc.backendId,organization:org});
      if(!backendDoc)continue;
      backendDoc.status=sub.status;await backendDoc.save();
      const backendSubmission=await Submission.findOne({document:backendDoc._id,creator:backendDoc.creator,organization:org}).sort({submittedAt:-1});
      if(backendSubmission){
        backendSubmission.status=sub.status;
        backendSubmission.decisionNote=String(sub.reviewComment||sub.legalComment||sub.legalReason||'');
        backendSubmission.decidedAt=new Date();backendSubmission.reviewer=req.user._id;
        await backendSubmission.save();
      }
    }
    res.json({saved:true,version:saved.version,updatedAt:saved.updatedAt});
  }catch(e){if(e.code===11000)return res.status(409).json({message:'Workspace was created in another session. Reload before saving.'});next(e);}
});

const audit=async(req,action,document=null,details={})=>AuditEvent.create({actor:req.user,actorName:req.user.name,role:req.user.role,action,document,details,organization:organizationKey(req)});
router.get('/dashboard',async(req,res,next)=>{try{const [state,users,rules]=await Promise.all([WorkspaceState.findOne({organization:organizationKey(req)}).lean(),User.countDocuments({organization:organizationKey(req)}),BrandRule.countDocuments({status:'Active',organization:organizationKey(req)})]);const d=state?.data||{};res.json({documents:(d.bg_creator_documents_v1||[]).length,submissions:(d.bg_creator_submissions_v1||[]).length,users,rules:(d.bg_knowledge_base_v1?.facts||[]).filter(x=>x.status==='Active').length+(d.bg_knowledge_base_v1?.terminology||[]).length+rules});}catch(e){next(e);}});
router.get('/knowledge',async(req,res,next)=>{try{res.json(await BrandRule.find({organization:organizationKey(req)}).sort({updatedAt:-1}));}catch(e){next(e);}});
const pdfUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:20*1024*1024},fileFilter:(req,file,cb)=>cb(null,file.mimetype==='application/pdf'||file.originalname.toLowerCase().endsWith('.pdf'))});
router.post('/knowledge/upload',allowRoles('Admin'),pdfUpload.single('file'),async(req,res,next)=>{try{
  if(!req.file)return res.status(400).json({message:'Choose a PDF file.'});
  const parsed=await pdfParse(req.file.buffer);const extracted=String(parsed.text||'').replace(/\s+/g,' ').trim();
  if(extracted.length<30)return res.status(422).json({message:'No readable text was found in this PDF. If it is a scanned document, run OCR before uploading.'});
  let fileUrl='',publicId='';
  if(process.env.CLOUDINARY_CLOUD_NAME&&process.env.CLOUDINARY_API_KEY&&process.env.CLOUDINARY_API_SECRET){
    cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});
    const uploaded=await new Promise((resolve,reject)=>{const stream=cloudinary.uploader.upload_stream({folder:'brandguard/guidelines',resource_type:'raw'},(error,result)=>error?reject(error):resolve(result));Readable.from(req.file.buffer).pipe(stream);});fileUrl=uploaded.secure_url;publicId=uploaded.public_id;
  }
  const rule=await BrandRule.create({type:'guideline',title:req.file.originalname,content:extracted,status:'Active',source:req.file.originalname,createdBy:req.user._id,organization:organizationKey(req),metadata:{pages:parsed.numpages,size:req.file.size,fileUrl,publicId}});
  await audit(req,'Brand guideline PDF uploaded',null,{ruleId:rule.id,title:rule.title,pages:parsed.numpages});res.status(201).json({id:rule.id,title:rule.title,pages:parsed.numpages,characters:extracted.length,status:rule.status,fileUrl});
}catch(e){next(e);}});

const assetUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024},fileFilter:(req,file,cb)=>cb(null,/^(image\/(png|jpeg|webp|svg\+xml)|application\/pdf)$/.test(file.mimetype))});
router.post('/assets/upload',allowRoles('Admin'),assetUpload.single('file'),async(req,res,next)=>{try{
  if(!req.file)return res.status(400).json({message:'Choose a supported image or PDF asset.'});
  if(!process.env.CLOUDINARY_CLOUD_NAME||!process.env.CLOUDINARY_API_KEY||!process.env.CLOUDINARY_API_SECRET)return res.status(503).json({message:'Persistent asset uploads require CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/.env.'});
  cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});
  const uploaded=await new Promise((resolve,reject)=>{const stream=cloudinary.uploader.upload_stream({folder:'brandguard/assets',resource_type:'auto'},(error,result)=>error?reject(error):resolve(result));Readable.from(req.file.buffer).pipe(stream);});
  const rule=await BrandRule.create({type:'asset',title:req.file.originalname,content:`Brand asset ${req.file.originalname}`,source:uploaded.secure_url,status:'Active',organization:organizationKey(req),createdBy:req.user._id,metadata:{publicId:uploaded.public_id,resourceType:uploaded.resource_type,format:uploaded.format,bytes:uploaded.bytes,width:uploaded.width,height:uploaded.height}});
  await audit(req,'Brand asset uploaded',null,{assetId:rule.id,title:rule.title});res.status(201).json({id:rule.id,name:rule.title,url:uploaded.secure_url,publicId:uploaded.public_id,format:uploaded.format,bytes:uploaded.bytes});
}catch(e){next(e);}});
router.delete('/assets/:id',allowRoles('Admin'),async(req,res,next)=>{try{const asset=await BrandRule.findOne({_id:req.params.id,organization:organizationKey(req),type:'asset'});if(!asset)return res.status(404).json({message:'Asset not found.'});if(asset.metadata?.publicId){cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});await cloudinary.uploader.destroy(asset.metadata.publicId,{resource_type:asset.metadata.resourceType||'image'});}await asset.deleteOne();await audit(req,'Brand asset deleted',null,{assetId:req.params.id});res.json({deleted:true});}catch(e){next(e);}});

router.post('/knowledge',allowRoles('Admin'),async(req,res,next)=>{try{const {title,content,type='guideline',source=''}=req.body;if(!title||!content)return res.status(400).json({message:'Title and content are required.'});const rule=await BrandRule.create({title,content,type,source,createdBy:req.user._id,organization:organizationKey(req)});await audit(req,'Brand guideline added',null,{ruleId:rule.id,title});res.status(201).json(rule);}catch(e){next(e);}});
router.patch('/knowledge/:id',allowRoles('Admin'),async(req,res,next)=>{try{const patch=Object.fromEntries(['title','content','type','status','source'].filter(key=>key in req.body).map(key=>[key,req.body[key]]));const rule=await BrandRule.findOneAndUpdate({_id:req.params.id,organization:organizationKey(req)},patch,{new:true,runValidators:true});if(!rule)return res.status(404).json({message:'Guideline not found.'});await audit(req,'Brand guideline updated',null,{ruleId:rule.id});res.json(rule);}catch(e){next(e);}});
router.delete('/knowledge/:id',allowRoles('Admin'),async(req,res,next)=>{try{const rule=await BrandRule.findOne({_id:req.params.id,organization:organizationKey(req)});if(!rule)return res.status(404).json({message:'Guideline not found.'});if(rule.metadata?.publicId){cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});await cloudinary.uploader.destroy(rule.metadata.publicId,{resource_type:'raw'});}await rule.deleteOne();await audit(req,'Brand guideline deleted',null,{ruleId:req.params.id});res.json({message:'Guideline deleted.'});}catch(e){next(e);}});
router.get('/documents',async(req,res,next)=>{try{const filter={organization:organizationKey(req),...(req.user.role==='Creator'?{creator:req.user._id}:{})};res.json(await Document.find(filter).populate('creator','name email').sort({updatedAt:-1}));}catch(e){next(e);}});
router.post('/documents',allowRoles('Creator','Admin'),async(req,res,next)=>{try{const doc=await Document.create({title:req.body.title||'Untitled document',content:req.body.content||'',creator:req.user._id,clientDocumentId:String(req.body.clientDocumentId||''),organization:organizationKey(req)});await audit(req,'Document created',doc._id);res.status(201).json(doc);}catch(e){next(e);}});
router.get('/documents/:id',async(req,res,next)=>{try{const doc=await Document.findOne({_id:req.params.id,organization:organizationKey(req)}).populate('creator','name email');if(!doc)return res.status(404).json({message:'Document not found.'});if(req.user.role==='Creator'&&String(doc.creator._id)!==String(req.user._id))return res.status(403).json({message:'You can only access your own documents.'});res.json(doc);}catch(e){next(e);}});
router.patch('/documents/:id',allowRoles('Creator','Admin'),async(req,res,next)=>{try{
  const doc=await Document.findOne({_id:req.params.id,organization:organizationKey(req)});
  if(!doc)return res.status(404).json({message:'Document not found.'});
  if(req.user.role==='Creator'&&String(doc.creator)!==String(req.user._id))return res.status(403).json({message:'You can only edit your own documents.'});
  if(req.user.role==='Creator'&&!['Draft','Changes Requested'].includes(doc.status))return res.status(409).json({message:'Only Draft or Changes Requested documents can be edited.'});
  // Creator-supplied status, version, scan results and activity are untrusted.
  // Only the server's scan/submit/review routes may change workflow state.
  const fields=['title','content'];
  const contentChanged='content' in req.body && String(req.body.content??'')!==String(doc.content??'');
  for(const key of fields)if(key in req.body)doc[key]=req.body[key];
  if(!doc.clientDocumentId&&req.body.clientDocumentId)doc.clientDocumentId=String(req.body.clientDocumentId);
  if(contentChanged){doc.scanResults=null;doc.scanContentHash=null;}
  await doc.save();await audit(req,'Document updated',doc._id,{contentChanged,scanInvalidated:contentChanged});res.json(doc);
}catch(e){next(e);}});
router.delete('/documents/:id',allowRoles('Creator','Admin'),async(req,res,next)=>{try{const doc=await Document.findOne({_id:req.params.id,organization:organizationKey(req)});if(!doc)return res.status(404).json({message:'Document not found.'});if(req.user.role==='Creator'&&String(doc.creator)!==String(req.user._id))return res.status(403).json({message:'You can only delete your own documents.'});if(req.user.role==='Creator'&&!['Draft','Changes Requested'].includes(doc.status))return res.status(409).json({message:'Only Draft or Changes Requested documents can be deleted.'});await doc.deleteOne();await audit(req,'Document deleted',doc._id);res.json({message:'Document deleted.'});}catch(e){next(e);}});
router.post('/scan',async(req,res,next)=>{try{
  const documentId=req.body.documentId;
  let content=String(req.body.content||'');
  let doc=null;
  if(documentId){
    doc=await Document.findOne({_id:documentId,organization:organizationKey(req)});
    if(!doc)return res.status(404).json({message:'Document not found.'});
    if(req.user.role==='Creator'&&String(doc.creator)!==String(req.user._id))return res.status(403).json({message:'You can only scan your own documents.'});
    if(content && content!==String(doc.content||''))return res.status(409).json({message:'The content changed. Save the latest document before scanning.'});
    content=String(doc.content||'');
  }
  const result=await scanBrandContent(content,req.user.organization||'BrandGuard');
  if(doc){doc.scanResults=result;doc.scanContentHash=contentHash(doc.content);await doc.save();}
  await audit(req,'Document scanned',documentId||null,{score:result.score,issueCount:result.issues.length,engine:result.engine});
  res.json({...result,contentHash:doc?.scanContentHash||contentHash(content)});
}catch(e){next(e);}});
router.post('/documents/:id/submit',async(req,res,next)=>{try{
  if(req.user.role!=='Creator')return res.status(403).json({message:'Only Creators can submit documents.'});
  const doc=await Document.findOne({_id:req.params.id,creator:req.user._id,organization:organizationKey(req)});
  if(!doc)return res.status(404).json({message:'Document not found.'});
  if(!['Draft','Changes Requested'].includes(doc.status))return res.status(409).json({message:'This document is not in a submittable state.'});
  if(!doc.scanResults||!doc.scanContentHash||doc.scanContentHash!==contentHash(doc.content))return res.status(400).json({message:'Run a fresh brand scan on the latest saved content before submitting.'});
  const active=await Submission.findOne({document:doc._id,creator:req.user._id,organization:organizationKey(req),status:'In Review'});
  if(active)return res.status(409).json({message:'This document already has a submission awaiting review.'});
  const sub=await Submission.create({document:doc._id,creator:req.user._id,complianceScore:doc.scanResults.score,issues:doc.scanResults.issues,organization:organizationKey(req)});
  doc.status='In Review';await doc.save();await audit(req,'Document submitted',doc._id,{submissionId:sub.id});res.status(201).json(await sub.populate([{path:'document'},{path:'creator',select:'name email'}]));
}catch(e){next(e);}});
router.get('/submissions',async(req,res,next)=>{try{const filter={organization:organizationKey(req),...(req.user.role==='Creator'?{creator:req.user._id}:{})};res.json(await Submission.find(filter).populate('document').populate('creator','name email').populate('reviewer','name email').sort({submittedAt:-1}));}catch(e){next(e);}});
router.patch('/submissions/:id/decision',allowRoles('Reviewer','Admin','Legal'),async(req,res,next)=>{try{
  const {status,decisionNote=''}=req.body;
  if(!['Approved','Changes Requested','Legal Review','Rejected'].includes(status))return res.status(400).json({message:'Invalid review decision.'});
  const sub=await Submission.findOne({_id:req.params.id,organization:organizationKey(req)});
  if(!sub)return res.status(404).json({message:'Submission not found.'});
  const pendingLegal=['Legal Review','In Legal Review'].includes(sub.status);
  if(req.user.role==='Legal'&&!pendingLegal)return res.status(409).json({message:'Only submissions awaiting Legal review can receive a Legal decision.'});
  if(req.user.role==='Reviewer'&&!['In Review','Submitted'].includes(sub.status))return res.status(409).json({message:'This submission is no longer awaiting Reviewer review.'});
  if(req.user.role==='Admin')return res.status(403).json({message:'Admins cannot make Reviewer or Legal decisions.'});
  if(req.user.role==='Reviewer'&&status==='Rejected')return res.status(403).json({message:'Reviewers must request changes or escalate to Legal; only Legal can reject.'});
  if(req.user.role==='Legal'&&status==='Legal Review')return res.status(400).json({message:'Legal cannot escalate a submission to Legal review.'});
  if(['Changes Requested','Rejected','Legal Review'].includes(status)&&!String(decisionNote).trim())return res.status(400).json({message:'A decision note is required for this outcome.'});
  const [state,linkedDocument]=await Promise.all([
    WorkspaceState.findOne({organization:organizationKey(req)}).lean(),
    Document.findOne({_id:sub.document,organization:organizationKey(req)}).lean()
  ]);
  const overrides=state?.data?.bg_critical_overrides_v1||[];
  const relevantOverrides=overrides.filter(item=>
    item.submissionId===String(sub._id)||item.submissionId===sub.id||
    (!!linkedDocument?.clientDocumentId&&item.documentId===linkedDocument.clientDocumentId)
  );
  if(status==='Approved'){
    const critical=(sub.issues||[]).filter(issue=>issue.severity==='Critical'&&!['Resolved','Dismissed'].includes(issue.status));
    const missing=critical.filter(issue=>!relevantOverrides.some(item=>item.issueId===issue.id&&String(item.reason||'').trim().length>=8&&['Reviewer','Legal'].includes(item.role)));
    if(missing.length)return res.status(400).json({message:`${missing.length} Critical issue(s) require resolution or a valid Reviewer/Legal override before approval.`});
  }
  const oldStatus=sub.status;
  sub.status=req.user.role==='Legal'&&status==='Approved'?'In Review':status;
  sub.reviewer=req.user._id;sub.decisionNote=String(decisionNote).trim();sub.decidedAt=new Date();await sub.save();
  const doc=linkedDocument?await Document.findById(linkedDocument._id):null;
  if(doc){doc.status=sub.status;await doc.save();}
  await audit(req,`Submission ${status.toLowerCase()}`,sub.document,{submissionId:sub.id,from:oldStatus,to:sub.status,decisionNote});
  res.json(sub);
}catch(e){next(e);}});
router.get('/audit',allowRoles('Admin','Reviewer','Legal'),async(req,res,next)=>{try{res.json(await AuditEvent.find({organization:organizationKey(req)}).populate('actor','name email').sort({createdAt:-1}).limit(500));}catch(e){next(e);}});
router.get('/users',allowRoles('Admin'),async(req,res,next)=>{try{const rows=await User.find({organization:organizationKey(req)}).select('-passwordHash').sort({createdAt:-1});res.json(rows.map(u=>({id:u.id,name:u.name,email:u.email,role:u.role,department:u.department,organization:u.organization,status:u.status,createdAt:u.createdAt,lastActivity:u.lastActivity})));}catch(e){next(e);}});
router.post('/users',allowRoles('Admin'),async(req,res,next)=>{try{const bcrypt=(await import('bcryptjs')).default;const {name,email,password,role='Creator',department='Unassigned',organization=''}=req.body;if(!name||!/^\S+@\S+\.\S+$/.test(String(email||''))||!password||password.length<8)return res.status(400).json({message:'Enter a valid email, name and a password of at least 8 characters.'});if(!['Creator','Reviewer','Admin','Legal'].includes(role))return res.status(400).json({message:'Invalid role.'});if(await User.exists({email:String(email).toLowerCase()}))return res.status(409).json({message:'An account with this email already exists.'});const user=await User.create({name,email,passwordHash:await bcrypt.hash(password,12),role,department,organization:organizationKey(req)});await audit(req,'User account created',null,{userId:user.id,email:user.email,role});res.status(201).json({id:user.id,name:user.name,email:user.email,role:user.role,department:user.department,organization:user.organization,status:user.status,joinedAt:user.createdAt,lastActivity:user.lastActivity});}catch(e){next(e);}});
router.patch('/users/:id',allowRoles('Admin'),async(req,res,next)=>{try{const target=await User.findOne({_id:req.params.id,organization:organizationKey(req)});if(!target)return res.status(404).json({message:'User not found.'});const nextRole=req.body.role??target.role,nextStatus=req.body.status??target.status;if(String(target._id)===String(req.user._id)&&(nextRole!=='Admin'||nextStatus!=='Active'))return res.status(400).json({message:'You cannot remove your own active Admin access.'});if(target.role==='Admin'&&target.status==='Active'&&(nextRole!=='Admin'||nextStatus!=='Active')&&await User.countDocuments({role:'Admin',status:'Active',organization:organizationKey(req)})<=1)return res.status(400).json({message:'The last active Admin cannot be demoted or deactivated.'});for(const field of ['name','role','department','status'])if(field in req.body)target[field]=req.body[field];if(!['Creator','Reviewer','Admin','Legal'].includes(target.role)||!['Active','Inactive'].includes(target.status))return res.status(400).json({message:'Invalid role or account status.'});await target.save();await audit(req,'User account updated',null,{userId:target.id,role:target.role,status:target.status});res.json({id:target.id,name:target.name,email:target.email,role:target.role,department:target.department,organization:target.organization,status:target.status});}catch(e){next(e);}});
export default router;
