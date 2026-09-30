import sys, zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

def extract(path):
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml')
    root = ET.fromstring(xml)
    out = []
    body = root.find(W + 'body')
    def walk(el):
        for child in el:
            tag = child.tag
            if tag == W + 'p':
                texts = [t.text or '' for t in child.iter(W + 't')]
                out.append(''.join(texts))
            elif tag == W + 'tbl':
                for tr in child.findall(W + 'tr'):
                    row = []
                    for tc in tr.findall(W + 'tc'):
                        cell_texts = []
                        for p in tc.findall(W + 'p'):
                            cell_texts.append(''.join(t.text or '' for t in p.iter(W + 't')))
                        row.append(' | '.join(cell_texts))
                    out.append('TABLEROW: ' + ' || '.join(row))
            else:
                walk(child)
    walk(body)
    return '\n'.join(out)

for path in sys.argv[1:]:
    text = extract(path)
    out_name = path.rsplit('.', 1)[0] + '.txt'
    with open(out_name, 'w', encoding='utf-8') as f:
        f.write(text)
    print('WROTE', out_name, len(text), 'chars')
