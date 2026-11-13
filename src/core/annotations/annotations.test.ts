import { describe, expect, it } from 'vitest'
import { fromAnchorPoint, nearestWord, toAnchorPoint, wordsInRange, type AnchorFrame } from './anchors'
import { applyMessage, emptyAnnotations, persistable, pruneLasers } from './protocol'
import {
  byteLength,
  decodePoints,
  encodePoints,
  hitsPolyline,
  laserOpacity,
  MAX_MESSAGE_BYTES,
  StrokeBatcher,
  type Stroke,
} from './strokes'

describe('ancrage indépendant de l’écran et du zoom', () => {
  it('page : le même point de la page, quelle que soit la taille d’affichage', () => {
    const prof: AnchorFrame = { box: { left: 100, top: 50, width: 600, height: 900 }, fontPx: 30 }
    const eleve: AnchorFrame = { box: { left: 0, top: 0, width: 300, height: 450 }, fontPx: 15 }
    const p = toAnchorPoint('page', prof, { x: 400, y: 500 })
    expect(p).toEqual([0.5, 0.5])
    expect(fromAnchorPoint('page', eleve, p)).toEqual({ x: 150, y: 225 })
  })

  it('mot : le trait suit le mot quand il change de place et de taille (reflow)', () => {
    const avant: AnchorFrame = { box: { left: 500, top: 100, width: 80, height: 40 }, fontPx: 32 }
    const apres: AnchorFrame = { box: { left: 20, top: 400, width: 160, height: 80 }, fontPx: 64 }
    // centre du mot avant : (540, 120) ; point 16 px à droite, 32 px en dessous
    const p = toAnchorPoint('word', avant, { x: 556, y: 152 })
    expect(p).toEqual([0.5, 1])
    // centre après : (100, 440) ; en em à 64 px → +32, +64
    expect(fromAnchorPoint('word', apres, p)).toEqual({ x: 132, y: 504 })
  })

  it('mot le plus proche du début du trait', () => {
    const words = [
      { id: '1:1:1' as const, rect: { left: 0, top: 0, width: 50, height: 20 } },
      { id: '1:1:2' as const, rect: { left: 100, top: 0, width: 50, height: 20 } },
    ]
    expect(nearestWord({ x: 90, y: 10 }, words)).toBe('1:1:2')
    expect(nearestWord({ x: 20, y: 40 }, words)).toBe('1:1:1')
    expect(nearestWord({ x: 0, y: 0 }, [])).toBeNull()
  })

  it('plage de mots, dans les deux sens', () => {
    const order = ['1:1:1', '1:1:2', '1:1:3', '1:2:1'] as const
    expect(wordsInRange(order, '1:2:1', '1:1:2')).toEqual(['1:1:2', '1:1:3', '1:2:1'])
  })
})

describe('envoi en direct', () => {
  it('quantification aller-retour à 1/10 000 près', () => {
    const pts = [
      [0.123456, 0.987654],
      [-0.5, 2.25],
    ] as const
    const back = decodePoints(encodePoints(pts))
    back.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(pts[i]![0], 4)
      expect(p[1]).toBeCloseTo(pts[i]![1], 4)
    })
  })

  it('un lot plein tient largement dans la limite de taille d’un message', () => {
    const batcher = new StrokeBatcher(0, 24, 40)
    let batch = null
    for (let i = 0; i < 24 && !batch; i++) batch = batcher.push([0.99999, 0.99999], 1)
    expect(batch).toHaveLength(24)
    const msg = JSON.stringify({ t: 'stroke-points', id: 'abcdefghij-1234567890', pts: encodePoints(batch!) })
    expect(byteLength(msg)).toBeLessThan(MAX_MESSAGE_BYTES)
  })

  it('envoie aussi au bout de 40 ms même s’il y a peu de points', () => {
    const batcher = new StrokeBatcher(0, 24, 40)
    expect(batcher.push([0, 0], 10)).toBeNull()
    expect(batcher.push([0, 1], 45)).toHaveLength(2)
    expect(batcher.flush(50)).toBeNull()
  })
})

describe('gomme et laser', () => {
  it('touche un trait près d’un segment', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]
    expect(hitsPolyline(line, { x: 50, y: 4 }, 5)).toBe(true)
    expect(hitsPolyline(line, { x: 50, y: 6 }, 5)).toBe(false)
  })

  const laser: Stroke = {
    id: 'l',
    author: 'prof',
    anchor: { kind: 'page', page: 604 },
    style: { tool: 'laser', color: 'red', width: 0.1 },
    points: [[0, 0]],
    done: true,
    endedAt: 1000,
  }

  it('le laser reste visible 1 s puis s’efface en fondu', () => {
    expect(laserOpacity(laser, 1500)).toBe(1)
    expect(laserOpacity(laser, 2500)).toBeCloseTo(0.5)
    expect(laserOpacity(laser, 3100)).toBe(0)
  })

  it('les lasers expirés sont retirés et jamais persistés', () => {
    const state = { strokes: [laser], marks: [] }
    expect(pruneLasers(state, 1500)).toBe(state)
    expect(pruneLasers(state, 3100).strokes).toHaveLength(0)
    expect(persistable(state).strokes).toHaveLength(0)
  })
})

describe('applyMessage', () => {
  it('reconstruit un trait à partir de ses lots', () => {
    let s = emptyAnnotations()
    s = applyMessage(
      s,
      {
        t: 'stroke-start',
        id: 'a',
        author: 'prof',
        anchor: { kind: 'word', word: '1:1:1' },
        style: { tool: 'pen', color: 'red', width: 0.08 },
      },
      'eleve',
    )
    s = applyMessage(s, { t: 'stroke-points', id: 'a', pts: encodePoints([[0.1, 0.2]]) }, 'eleve')
    s = applyMessage(s, { t: 'stroke-points', id: 'a', pts: encodePoints([[0.3, 0.4]]) }, 'eleve')
    s = applyMessage(s, { t: 'stroke-end', id: 'a', endedAt: 5 }, 'eleve')
    expect(s.strokes[0]).toMatchObject({ done: true, points: [[0.1, 0.2], [0.3, 0.4]] })
  })

  it('l’état de synchro ne s’applique qu’à son destinataire', () => {
    const state = { strokes: [], marks: [{ id: 'm', author: 'p', words: [], kind: 'highlight' as const, color: 'red' as const }] }
    const msg = { t: 'sync-state' as const, to: 'eleve', ...state }
    expect(applyMessage(emptyAnnotations(), msg, 'autre').marks).toHaveLength(0)
    expect(applyMessage(emptyAnnotations(), msg, 'eleve').marks).toHaveLength(1)
  })
})
