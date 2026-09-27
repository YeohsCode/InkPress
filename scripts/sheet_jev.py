from PIL import Image
import glob
files = sorted(glob.glob('data/images/html/*.png'))
print(len(files), 'pages')
imgs = [Image.open(f).convert('RGB') for f in files]
w, h = 1242, 1656
sheet = Image.new('RGB', (w*3, h*3), 'white')
for idx, im in enumerate(imgs):
    sheet.paste(im.resize((w, h)), ((idx % 3) * w, (idx // 3) * h))
sheet.save('/tmp/sheet_jev.png')
print('sheet', sheet.size)
