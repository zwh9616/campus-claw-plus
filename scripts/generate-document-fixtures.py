"""DI-SC-03/04: deterministic, self-authored acceptance inputs; no extraction results.

Requires the authoring-only ReportLab 4.4.9 and the independently verified font
paths recorded in testdata/font-sources.json. Runtime tests consume committed
files and never require ReportLab or an office application.
"""
from pathlib import Path
import argparse, hashlib, json, zipfile, shutil
from xml.etree import ElementTree as ET
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ap=argparse.ArgumentParser();ap.add_argument('--cjk-font',required=True);args=ap.parse_args()
root=Path(__file__).resolve().parents[1];out=root/'document-parser/testdata/acceptance-v1';pdfout=root/'output/pdf/document-fixtures';out.mkdir(parents=True,exist_ok=True);pdfout.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('FixtureCJK',args.cjk_font))
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';ET.register_namespace('w',W)
def tag(n):return '{'+W+'}'+n
def record(file,fmt,gold,coverage):return {'id':file.stem,'file':file.name,'format':fmt,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'bytes':file.stat().st_size,'expected_status':'ready','gold':gold,'coverage':coverage,'origin':'self-authored CampusClawPlus DI acceptance fixture; no real learner data'}
def para(parent,text,bold=False):
 p=ET.SubElement(parent,tag('p'));run=ET.SubElement(p,tag('r'))
 if bold:ET.SubElement(ET.SubElement(run,tag('rPr')),tag('b'))
 # Explicit tabs/breaks are XML elements, never XML text containing controls.
 current=''
 for char in text:
  if char in '\t\n':
   if current:t=ET.SubElement(run,tag('t'));t.set('{http://www.w3.org/XML/1998/namespace}space','preserve');t.text=current;current=''
   ET.SubElement(run,tag('tab' if char=='\t' else 'br'))
  else:current+=char
 if current:t=ET.SubElement(run,tag('t'));t.set('{http://www.w3.org/XML/1998/namespace}space','preserve');t.text=current
 return p
content_types=b'''<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'''
rels=b'''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'''
def make_docx(n):
 doc=ET.Element(tag('document'));body=ET.SubElement(doc,tag('body'));gold=[];unit=0
 def add(parent,text,kind='docx_paragraph',bold=False):
  nonlocal unit
  para(parent,text,bold);unit+=1
  if text.strip():gold.append({'kind':kind,'unit':unit,'text':text})
 add(body,f'DI-A-DOCX-{n:02d}',bold=True)
 if n%4==0:add(body,'')
 variants=[f'第{n}讲：课程资料与班级授权。',f'Lesson {n}: Read the source before drawing a conclusion.',f'中文与English混合，编号{n}，保留原文出处。',f'术语对照：资料 source；班级 class；出处 citation。']
 add(body,variants[(n-1)%4])
 if n in (3,7,11,15,19):add(body,'Unicode边界：😀、é、e\u0301、α、β、x²。')
 if n in (6,9,12,18):add(body,'第一项\t第二项\n下一行保留换行。')
 if n in (5,10,15,20):
  table=ET.SubElement(body,tag('tbl'))
  for row in range(2):
   tr=ET.SubElement(table,tag('tr'))
   for col in range(2):
    cell=ET.SubElement(tr,tag('tc'));add(cell,f'单元格{row+1}-{col+1}：本班资料{n}。','docx_table_cell')
    if row==0 and col==0:add(cell,'单元格中的第二段。','docx_table_cell')
 if n==17:
  for i in range(80):add(body,f'条目{i+1:03d}：检索结果必须核对出处，标识{hashlib.sha256(str(i).encode()).hexdigest()[:12]}。')
 if n==19:add(body,' '.join(f'术语{i:03d}-{hashlib.sha256(str(i).encode()).hexdigest()[:8]}' for i in range(240)))
 add(body,f'验收关键句{n:02d}：跨班资料不可访问。')
 ET.SubElement(body,tag('sectPr'))
 f=out/f'clear-{n:02d}.docx'
 with zipfile.ZipFile(f,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for name,data in [('[Content_Types].xml',content_types),('_rels/.rels',rels),('word/document.xml',ET.tostring(doc,encoding='utf-8',xml_declaration=True))]:
   info=zipfile.ZipInfo(name,date_time=(2026,11,13,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,data,compresslevel=9)
 return record(f,'docx',gold,['paragraphs','table-multiple-paragraphs' if n%5==0 else 'plain-text','logical-blocks-no-page-claim'])
def wrap(text,font,size,width):
 lines=[];line=''
 for ch in text:
  if pdfmetrics.stringWidth(line+ch,font,size)>width and line:lines.append(line);line=ch
  else:line+=ch
 if line:lines.append(line)
 return lines
def make_pdf(n):
 f=pdfout/f'clear-{n:02d}.pdf';c=canvas.Canvas(str(f),pagesize=(595,842),invariant=1,pageCompression=1);c.setTitle(f'DI acceptance clear PDF {n:02d}');c.setAuthor('CampusClawPlus synthetic fixtures');gold=[]
 pages=2 if n%4==0 else 1
 for page in range(1,pages+1):
  lines=[f'DI-A-PDF-{n:02d} / PAGE {page}',f'第{n}讲：课程资料、授权与出处。',f'Lesson {n}: preserve the original source.',f'验收关键句{n:02d}-{page}：跨班资料不可访问。']
  if n%3==0:lines.append('标点与数字：2026，1.25，50%，α + β = γ。')
  if n%7==0:lines.append('长句用于检查自动换行：'+'本班学生可以阅读已经完成处理的资料，并逐字核对原文出处。'*3)
  y=788;drawn=[]
  for line in lines:
   font='FixtureCJK' if any(ord(ch)>127 for ch in line) else 'Helvetica'
   for part in wrap(line,font,18,495):
    c.setFont(font,18);c.drawString(50,y,part);drawn.append(part);y-=33
  if n%5==0:
   c.setLineWidth(.6)
   for row in [['课程','周次','状态'],['课程A','第1周','已完成'],['课程B','第2周','进行中']]:
    c.rect(50,y-12,495,40)
    for k,cell in enumerate(row):
     if k:c.line(50+165*k,y-12,50+165*k,y+28)
     c.setFont('FixtureCJK',18);c.drawString(58+165*k,y,cell);drawn.append(cell)
    y-=40
  assert y>120
  gold.append({'kind':'pdf_page','unit':page,'text':'\n'.join(drawn)+'\n'})
  c.showPage()
 c.save();shutil.copyfile(f,out/f.name)
 return record(out/f.name,'pdf',gold,['embedded-fonts','CJK-English','multi-page' if pages>1 else 'single-page','text-table' if n%5==0 else 'paragraphs'])
manifest={'version':'di-acceptance-v1','frozen_before_parser_implementation':True,'created_by':'zwh9616','date':'2026-11-13','score_normalization':'NFC, collapse Unicode White_Space to one ASCII space, trim; preserve case/punctuation','quality_status':'gold inputs only; no parser pass or CER measurement claim','cases':[make_pdf(n) for n in range(1,21)]+[make_docx(n) for n in range(1,21)]}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'pdf':20,'docx':20,'pdf_pages':sum(len(x['gold']) for x in manifest['cases'] if x['format']=='pdf'),'directory':str(out),'bytes':sum(x['bytes'] for x in manifest['cases'])}))
