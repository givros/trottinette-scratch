from hashlib import md5
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
FILES = {}
SPEED = 'speed'
LIGHT = 'light'
LABELS = {SPEED: 'Vitesse (km/h)', LIGHT: 'Phare (0/1)', 'position': 'Position sur la piste'}


def costume(name, image, center):
    data = BytesIO()
    image.save(data, 'PNG')
    payload = data.getvalue()
    asset_id = md5(payload).hexdigest()
    filename = f'{asset_id}.png'
    FILES[filename] = payload
    return dict(name=name, assetId=asset_id, md5ext=filename, dataFormat='png',
                bitmapResolution=1, rotationCenterX=center[0], rotationCenterY=center[1])


source = Image.open(ROOT / 'assets/xiaomi-m365.jpg').convert('RGBA')
park = Image.open(ROOT / 'assets/park-reference.jpg').convert('RGB')
hedge = ImageOps.fit(source.crop((185, 0, 360, 300)).convert('RGB'), (480, 275))
hedge = ImageEnhance.Brightness(hedge.filter(ImageFilter.GaussianBlur(1.5))).enhance(.76)
road = ImageOps.fit(park.crop((0, 406, 337, 450)), (480, 90))
scene = Image.new('RGB', (480, 360))
scene.paste(hedge)
scene.paste(road, (0, 270))
line = ImageDraw.Draw(scene)
line.line((0, 272, 480, 272), fill='#85877a', width=3)
for x in range(12, 480, 75):
    line.line((x, 328, x + 29, 328), fill='#d3d2bf', width=2)

mask = Image.new('L', source.size)
draw = ImageDraw.Draw(mask)
draw.polygon([(79,13),(91,13),(113,24),(117,19),(126,19),(132,26),(130,33),(168,54),
              (179,65),(179,76),(170,83),(158,79),(139,66),(128,69),(119,126),
              (102,204),(84,278),(80,310),(79,328),(91,347),(109,362),(149,363),
              (256,360),(273,352),(295,347),(322,345),(337,352),(350,366),(351,378),
              (345,393),(330,404),(306,409),(280,403),(273,397),(252,399),(245,436),
              (240,437),(241,405),(126,407),(106,403),(93,392),(88,408),(72,421),
              (51,425),(32,420),(17,413),(13,398),(19,385),(21,373),(30,365),
              (47,355),(50,337),(58,323),(59,300),(65,281),(80,213),(97,144),
              (111,86),(95,62),(89,46),(87,33),(78,28)], fill=255)
source.putalpha(mask.filter(ImageFilter.GaussianBlur(.65)))
visuals = ROOT / 'public/simulator'
visuals.mkdir(parents=True, exist_ok=True)
scene.save(visuals / 'track.jpg', quality=94)
ImageOps.mirror(source).save(visuals / 'scooter.png')
for name, x, y, radius in [('rear', 307, 380, 19), ('front', 53, 397, 16)]:
    wheel = ImageOps.mirror(source.crop((x-radius,y-radius,x+radius,y+radius))).convert('RGBA')
    alpha = Image.new('L', wheel.size)
    ImageDraw.Draw(alpha).ellipse((0,0,2*radius-1,2*radius-1), fill=255)
    wheel.putalpha(alpha.filter(ImageFilter.GaussianBlur(.7)))
    wheel.save(visuals / f'{name}.png')
BACKGROUND = costume('Piste d’essai', scene, (240, 180))


def generate():
    stage = dict(isStage=True, name='Stage', variables={key: [label, -175 if key == 'position' else 0] for key, label in LABELS.items()},
                 lists={}, broadcasts={}, blocks={}, comments={}, currentCostume=0,
                 costumes=[BACKGROUND], sounds=[], volume=100, layerOrder=0, tempo=60,
                 videoTransparency=50, videoState='off', textToSpeechLanguage=None)
    monitors = [dict(id=key, mode='default', opcode='data_variable', params={'VARIABLE': label},
                     spriteName=None, value=-175 if key == 'position' else 0, width=0, height=0, x=8, y=8 + 28 * index,
                     visible=True, sliderMin=0, sliderMax=100, isDiscrete=True)
                for index, (key, label) in enumerate(LABELS.items())]
    project = dict(targets=[stage], monitors=monitors, extensions=[],
                   meta=dict(semver='3.0.0', vm='15.3.0', agent=''))
    filename = 'trottinette-depart.sb3'
    with ZipFile(ROOT / 'public/projects' / filename, 'w', ZIP_DEFLATED) as archive:
        archive.writestr('project.json', json.dumps(project, ensure_ascii=False))
        for asset, payload in FILES.items():
            archive.writestr(asset, payload)


generate()
