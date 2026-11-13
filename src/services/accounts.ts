import type { ProgressRow, VerseStatus } from '@/core/progress/progress'
import { invalidate } from '@/lib/query'
import { requireSupabase, type AppRole, type Profile, type Tables } from './supabase'

/**
 * Accès aux données des comptes. Toutes les requêtes passent par les
 * politiques RLS : chaque fonction ne renvoie que ce que l'utilisateur a le droit de voir.
 */

function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error
  return res.data
}

/** Comme check, pour une liste : sans erreur, la liste est toujours présente. */
function rows<T>(res: { data: T[] | null; error: unknown }): T[] {
  if (res.error) throw res.error
  return res.data ?? []
}

// ---------------------------------------------------------------- compte

export async function signIn(email: string, password: string) {
  const { error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw error
}

export async function signUp(input: { email: string; password: string; displayName: string; invite: string }) {
  const { data, error } = await requireSupabase().auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: { invite: input.invite, display_name: input.displayName.trim() } },
  })
  if (error) throw error
  return { needsConfirmation: !data.session }
}

export async function signOut() {
  await requireSupabase().auth.signOut()
}

export async function requestPasswordReset(email: string, redirectTo: string) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo })
  if (error) throw error
}

export async function updatePassword(password: string) {
  const { error } = await requireSupabase().auth.updateUser({ password })
  if (error) throw error
}

export async function updateDisplayName(id: string, displayName: string) {
  check(await requireSupabase().from('profiles').update({ display_name: displayName.trim() }).eq('id', id))
  invalidate('profiles')
}

export async function deleteMyAccount() {
  check(await requireSupabase().rpc('delete_my_account'))
  await requireSupabase().auth.signOut({ scope: 'local' })
}

// ---------------------------------------------------------------- invitations

export type InviteInfo = { kind: 'class'; className: string; teacherName: string } | { kind: 'staff'; role: AppRole }

export async function checkInvite(code: string): Promise<InviteInfo | null> {
  const r = rows(await requireSupabase().rpc('check_invite', { code }))[0]
  if (!r) return null
  return r.kind === 'class' ? { kind: 'class', className: r.class_name, teacherName: r.teacher_name } : { kind: 'staff', role: r.role }
}

export async function joinClass(code: string) {
  const id = check(await requireSupabase().rpc('join_class', { code }))
  invalidate('classes')
  return id
}

// ---------------------------------------------------------------- classes

export type ClassRow = Tables<'classes'> & { teacher: { display_name: string } | null; members: { count: number }[] }

export async function listClasses(): Promise<ClassRow[]> {
  const data = check(
    await requireSupabase()
      .from('classes')
      .select('*, teacher:profiles!classes_teacher_id_fkey(display_name), members:class_members(count)')
      .order('created_at'),
  )
  return data as unknown as ClassRow[]
}

export async function getClass(id: string): Promise<ClassRow | null> {
  const data = check(
    await requireSupabase()
      .from('classes')
      .select('*, teacher:profiles!classes_teacher_id_fkey(display_name), members:class_members(count)')
      .eq('id', id)
      .maybeSingle(),
  )
  return data as unknown as ClassRow | null
}

export async function createClass(teacherId: string, name: string) {
  const data = check(await requireSupabase().from('classes').insert({ teacher_id: teacherId, name: name.trim() }).select('id').single())
  invalidate('classes')
  return data!.id
}

export async function updateClass(id: string, patch: { name?: string; invite_open?: boolean }) {
  check(await requireSupabase().from('classes').update(patch).eq('id', id))
  invalidate('classes')
}

export async function deleteClass(id: string) {
  check(await requireSupabase().from('classes').delete().eq('id', id))
  invalidate('classes')
}

export async function regenerateInviteCode(classId: string) {
  check(await requireSupabase().rpc('regenerate_invite_code', { class_id: classId }))
  invalidate('classes')
}

export type MemberRow = { student_id: string; joined_at: string; student: Pick<Profile, 'id' | 'display_name' | 'role'> | null }

export async function listMembers(classId: string): Promise<MemberRow[]> {
  const data = check(
    await requireSupabase()
      .from('class_members')
      .select('student_id, joined_at, student:profiles!class_members_student_id_fkey(id, display_name, role)')
      .eq('class_id', classId)
      .order('joined_at'),
  )
  return data as unknown as MemberRow[]
}

export async function removeMember(classId: string, studentId: string) {
  check(await requireSupabase().from('class_members').delete().eq('class_id', classId).eq('student_id', studentId))
  invalidate('classes')
}

export async function getProfile(id: string): Promise<Profile | null> {
  return check(await requireSupabase().from('profiles').select('*').eq('id', id).maybeSingle())
}

// ---------------------------------------------------------------- progression

export async function listProgress(studentId: string, surah?: number): Promise<ProgressRow[]> {
  let q = requireSupabase().from('verse_progress').select('surah, ayah, status').eq('student_id', studentId)
  if (surah) q = q.eq('surah', surah)
  // une sourate fait au plus 286 versets, mais tout le Coran peut dépasser la limite par défaut (1 000 lignes)
  return rows(await q.order('surah').order('ayah').range(0, 6999))
}

export async function setVerseStatus(studentId: string, rows: readonly ProgressRow[]) {
  if (rows.length === 0) return
  check(
    await requireSupabase()
      .from('verse_progress')
      .upsert(rows.map((r) => ({ student_id: studentId, surah: r.surah, ayah: r.ayah, status: r.status })), {
        onConflict: 'student_id,surah,ayah',
      }),
  )
  invalidate(`progress:${studentId}`)
}

export type { VerseStatus }

// ---------------------------------------------------------------- notes du professeur

export type NoteRow = Tables<'teacher_notes'> & { teacher: { display_name: string } | null }

export async function listNotes(surah: number): Promise<NoteRow[]> {
  const data = check(
    await requireSupabase()
      .from('teacher_notes')
      .select('*, teacher:profiles!teacher_notes_teacher_id_fkey(display_name)')
      .eq('surah', surah)
      .order('ayah'),
  )
  return data as unknown as NoteRow[]
}

export async function saveNote(teacherId: string, surah: number, ayah: number, content: string) {
  const text = content.trim()
  const db = requireSupabase()
  if (!text) {
    check(await db.from('teacher_notes').delete().eq('teacher_id', teacherId).eq('surah', surah).eq('ayah', ayah))
  } else {
    // update d'abord (droits limités à la colonne content), insert si la note n'existe pas
    const updated = rows(
      await db.from('teacher_notes').update({ content: text }).eq('teacher_id', teacherId).eq('surah', surah).eq('ayah', ayah).select('id'),
    )
    if (updated.length === 0) check(await db.from('teacher_notes').insert({ teacher_id: teacherId, surah, ayah, content: text }))
  }
  invalidate(`notes:${surah}`)
}

// ---------------------------------------------------------------- admin

export type UserRow = { id: string; email: string; display_name: string; role: AppRole; created_at: string; last_sign_in_at: string | null }

export async function adminListUsers(): Promise<UserRow[]> {
  return check(await requireSupabase().rpc('admin_list_users')) as UserRow[]
}

export async function adminSetRole(target: string, role: AppRole) {
  check(await requireSupabase().rpc('admin_set_role', { target, new_role: role }))
  invalidate('admin')
}

export type StaffInvitation = Tables<'staff_invitations'>

export async function listStaffInvitations(): Promise<StaffInvitation[]> {
  return rows(await requireSupabase().from('staff_invitations').select('*').order('created_at', { ascending: false }))
}

export async function createStaffInvitation(createdBy: string, role: AppRole, note: string) {
  check(await requireSupabase().from('staff_invitations').insert({ role, note: note.trim() || null, created_by: createdBy }))
  invalidate('admin')
}

export async function deleteStaffInvitation(code: string) {
  check(await requireSupabase().from('staff_invitations').delete().eq('code', code))
  invalidate('admin')
}
