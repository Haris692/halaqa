import { describe, expect, it } from 'vitest'
import { emptyAnnotations, type AnnotationState } from '../annotations/protocol'
import {
  acceptMessage,
  followTarget,
  parseQuiz,
  quizLeadWords,
  removeCorrection,
  sameView,
  topVisibleVerse,
  upsertCorrection,
  verseRanges,
  visibleCorrections,
  wordClasses,
  type Correction,
  type LiveMessage,
} from './tools'

const PROF = 'prof'
const AMINA = 'amina'
const BILAL = 'bilal'

const corr = (over: Partial<Correction> = {}): Correction => ({
  id: 'c1',
  room_id: 'r1',
  student_id: AMINA,
  author_id: PROF,
  author_role: 'teacher',
  status: 'confirmed',
  word: '112:1:2',
  error_type: 'tajweed',
  tajweed_rule: 'ghunna',
  comment: null,
  ...over,
})

const boardWith = (annotations: AnnotationState = emptyAnnotations(), corrections: Correction[] = []) => ({ annotations, corrections })

describe('réception des messages de la salle', () => {
  const rules = { teacherId: PROF, studentPen: false }
  const stroke = (author: string): LiveMessage => ({
    t: 'stroke-start',
    id: 's1',
    author,
    anchor: { kind: 'word', word: '112:1:1' },
    style: { tool: 'pen', color: 'red', width: 0.09 },
  })

  it('le prof dessine ; un élève seulement si le prof l’autorise', () => {
    expect(acceptMessage(stroke(PROF), PROF, rules, boardWith())).toBe(true)
    expect(acceptMessage(stroke(AMINA), AMINA, rules, boardWith())).toBe(false)
    expect(acceptMessage(stroke(AMINA), AMINA, { ...rules, studentPen: true }, boardWith())).toBe(true)
  })

  it('personne ne dessine au nom d’un autre', () => {
    expect(acceptMessage(stroke(PROF), AMINA, { ...rules, studentPen: true }, boardWith())).toBe(false)
  })

  it('on ne prolonge ni n’efface le trait d’un autre ; seul le prof efface tout', () => {
    const board = boardWith({
      strokes: [{ id: 's1', author: PROF, anchor: { kind: 'word', word: '112:1:1' }, style: { tool: 'pen', color: 'red', width: 0.1 }, points: [], done: false }],
      marks: [],
    })
    expect(acceptMessage({ t: 'stroke-points', id: 's1', pts: [1, 2] }, AMINA, rules, board)).toBe(false)
    expect(acceptMessage({ t: 'stroke-points', id: 's1', pts: [1, 2] }, PROF, rules, board)).toBe(true)
    expect(acceptMessage({ t: 'erase', ids: ['s1'] }, AMINA, rules, board)).toBe(false)
    expect(acceptMessage({ t: 'clear' }, AMINA, rules, board)).toBe(false)
    expect(acceptMessage({ t: 'clear' }, PROF, rules, board)).toBe(true)
  })

  it('corrections : le prof confirme ; le binôme marque en attente, jamais sur lui-même', () => {
    expect(acceptMessage({ t: 'corr', c: corr() }, PROF, rules, boardWith())).toBe(true)
    const peer = corr({ id: 'c2', author_id: BILAL, author_role: 'peer', status: 'pending' })
    expect(acceptMessage({ t: 'corr', c: peer }, BILAL, rules, boardWith())).toBe(true)
    expect(acceptMessage({ t: 'corr', c: { ...peer, status: 'confirmed' } }, BILAL, rules, boardWith())).toBe(false)
    expect(acceptMessage({ t: 'corr', c: { ...peer, student_id: BILAL } }, BILAL, rules, boardWith())).toBe(false)
    expect(acceptMessage({ t: 'corr', c: { ...peer, author_id: PROF } }, BILAL, rules, boardWith())).toBe(false)
  })

  it('le binôme retire son marquage en attente, pas une correction du prof', () => {
    const board = boardWith(emptyAnnotations(), [corr(), corr({ id: 'c2', author_id: BILAL, author_role: 'peer', status: 'pending' })])
    expect(acceptMessage({ t: 'corr-del', id: 'c2' }, BILAL, rules, board)).toBe(true)
    expect(acceptMessage({ t: 'corr-del', id: 'c1' }, BILAL, rules, board)).toBe(false)
    expect(acceptMessage({ t: 'corr-del', id: 'c1' }, PROF, rules, board)).toBe(true)
  })
})

describe('corrections affichées', () => {
  it('ajout, mise à jour et retrait', () => {
    let list = upsertCorrection([], corr())
    list = upsertCorrection(list, corr({ comment: 'ghunna de 2 temps' }))
    expect(list).toHaveLength(1)
    expect(list[0]!.comment).toBe('ghunna de 2 temps')
    expect(removeCorrection(list, 'c1')).toEqual([])
  })

  it('on ne voit que celles de l’élève suivi', () => {
    const list = [corr(), corr({ id: 'c2', student_id: BILAL })]
    expect(visibleCorrections(list, BILAL).map((c) => c.id)).toEqual(['c2'])
    expect(visibleCorrections(list, null)).toEqual([])
  })

  it('le mot fautif passe en rouge ; un marquage non confirmé reste distinct', () => {
    const map = wordClasses(
      [{ id: 'm1', author: AMINA, words: ['112:1:1', '112:1:2'], kind: 'highlight', color: 'green' }],
      [corr(), corr({ id: 'c2', word: '112:1:3', status: 'pending' })],
      PROF,
    )
    expect(map.get('112:1:1')).toBe('mark-highlight-green mark-student')
    expect(map.get('112:1:2')).toBe('mark-highlight-green mark-student corr-error')
    expect(map.get('112:1:3')).toBe('corr-pending')
  })
})

describe('vue partagée', () => {
  it('l’élève suit le prof qui a la main ; le prof suit l’élève choisi', () => {
    expect(followTarget({ me: AMINA, isTeacher: false, leaderId: PROF, chosen: null })).toBe(PROF)
    expect(followTarget({ me: AMINA, isTeacher: false, leaderId: null, chosen: BILAL })).toBe(null)
    expect(followTarget({ me: PROF, isTeacher: true, leaderId: null, chosen: AMINA })).toBe(AMINA)
    // quand le prof a la main, il ne suit personne
    expect(followTarget({ me: PROF, isTeacher: true, leaderId: PROF, chosen: AMINA })).toBe(null)
  })

  it('premier verset visible sous l’en-tête', () => {
    const verses = [
      { key: '112:1', top: -200, bottom: 40 },
      { key: '112:2', top: 40, bottom: 160 },
      { key: '112:3', top: 160, bottom: 280 },
    ]
    expect(topVisibleVerse(verses, 64)).toBe('112:2')
    expect(topVisibleVerse(verses, 0)).toBe('112:1')
    expect(topVisibleVerse([], 0)).toBe(null)
  })

  it('compare deux vues sans tenir compte de l’horodatage', () => {
    const a = { mode: 'reading' as const, verse: '112:1' as const, page: 604, playing: null, at: 1 }
    expect(sameView(a, { ...a, at: 2 })).toBe(true)
    expect(sameView(a, { ...a, verse: '112:2' })).toBe(false)
  })
})

describe('test « continue le verset »', () => {
  it('lit l’état venu de la base, rejette le reste', () => {
    expect(parseQuiz({ student_id: AMINA, verse: '112:1', revealed: false, started_at: 'x' })?.verse).toBe('112:1')
    expect(parseQuiz({ student_id: AMINA, verse: 'abc' })).toBe(null)
    expect(parseQuiz(null)).toBe(null)
  })

  it('montre 1 à 3 mots selon la longueur du verset', () => {
    expect(quizLeadWords(2)).toBe(1)
    expect(quizLeadWords(8)).toBe(2)
    expect(quizLeadWords(40)).toBe(3)
  })
})

describe('récapitulatif', () => {
  it('regroupe les versets consécutifs', () => {
    expect(verseRanges(['112:3', '112:1', '112:2', '113:5', '112:2', '1:7'])).toEqual(['1:7', '112:1-3', '113:5'])
  })
})
