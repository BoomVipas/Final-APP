/**
 * app/family-contacts.tsx
 * Per-patient family contacts list + add/edit form for `family_contacts`.
 * Linked from patient detail (Workflow 12).
 */

import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'

import QRCode from 'react-native-qrcode-svg'

import { supabase } from '../src/lib/supabase'
import { USE_MOCK } from '../src/mocks'
import type { FamilyContactsRow } from '../src/types/database'
import { buildFamilyInviteUrl, sendTestMessage } from '../src/lib/lineNotifier'

const LINE_OA_BASIC_ID = process.env.EXPO_PUBLIC_LINE_OA_BASIC_ID ?? ''

type ContactDraft = {
  id?: string
  name: string
  relationship: string
  line_user_id: string
  phone: string
}

const EMPTY_DRAFT: ContactDraft = {
  name: '',
  relationship: '',
  line_user_id: '',
  phone: '',
}

function fromRow(row: FamilyContactsRow): ContactDraft {
  return {
    id: row.id,
    name: row.name,
    relationship: row.relationship ?? '',
    line_user_id: row.line_user_id ?? '',
    phone: row.phone ?? '',
  }
}

export default function FamilyContactsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ patientId?: string; patientName?: string }>()
  const patientId = Array.isArray(params.patientId) ? params.patientId[0] : params.patientId
  const patientName = (Array.isArray(params.patientName) ? params.patientName[0] : params.patientName) ?? 'Patient'

  const [loading, setLoading] = useState(true)
  const [contacts, setContacts] = useState<FamilyContactsRow[]>([])
  const [editor, setEditor] = useState<ContactDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyContactId, setBusyContactId] = useState<string | null>(null)
  const [inviteFor, setInviteFor] = useState<FamilyContactsRow | null>(null)

  const load = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    if (USE_MOCK) {
      setContacts([])
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('family_contacts')
      .select('id, patient_id, name, relationship, line_user_id, phone, notification_preferences, link_token, linked_at, created_at')
      .eq('patient_id', patientId)
      .order('name', { ascending: true })
    setContacts((data ?? []) as FamilyContactsRow[])
    setLoading(false)
  }, [patientId])

  useEffect(() => {
    load()
  }, [load])

  const closeEditor = () => {
    if (saving) return
    setEditor(null)
  }

  const validate = (draft: ContactDraft): string | null => {
    if (!draft.name.trim()) return 'Please enter a contact name.'
    return null
  }

  const saveDraft = async () => {
    if (!patientId || !editor) return
    const errMsg = validate(editor)
    if (errMsg) {
      Alert.alert('Cannot save', errMsg)
      return
    }
    setSaving(true)
    const payload = {
      patient_id: patientId,
      name: editor.name.trim(),
      relationship: editor.relationship.trim() || null,
      line_user_id: editor.line_user_id.trim() || null,
      phone: editor.phone.trim() || null,
    }

    if (USE_MOCK) {
      Alert.alert('Mock mode', 'Contact would be saved to family_contacts in live mode.')
      setSaving(false)
      setEditor(null)
      return
    }

    const { error } = editor.id
      ? await supabase.from('family_contacts').update(payload).eq('id', editor.id)
      : await supabase.from('family_contacts').insert(payload)

    setSaving(false)
    if (error) {
      Alert.alert('Save failed', error.message)
      return
    }
    setEditor(null)
    await load()
  }

  const openInvite = (row: FamilyContactsRow) => {
    if (USE_MOCK) {
      Alert.alert('Mock mode', 'LINE invites require live Supabase + LINE setup.')
      return
    }
    if (!LINE_OA_BASIC_ID) {
      Alert.alert(
        'LINE not configured',
        'Set EXPO_PUBLIC_LINE_OA_BASIC_ID in .env.local to your PILLo OA basic ID (the @xxxxxxx string), then restart Expo.',
      )
      return
    }
    setInviteFor(row)
  }

  const shareInvite = async (row: FamilyContactsRow) => {
    const url = buildFamilyInviteUrl({ oaBasicId: LINE_OA_BASIC_ID, linkToken: row.link_token })
    try {
      await Share.share({
        message: `Join PILLo notifications for ${patientName}: ${url}`,
        url,
      })
    } catch {
      // user dismissed sheet — no-op
    }
  }

  const handleSendTest = async (row: FamilyContactsRow) => {
    if (USE_MOCK) {
      Alert.alert('Mock mode', 'Test sends require live Supabase + LINE setup.')
      return
    }
    if (!row.line_user_id) {
      Alert.alert('Not linked yet', 'Generate a link code and have the family member send it to the LINE OA first.')
      return
    }
    setBusyContactId(row.id)
    try {
      const result = await sendTestMessage({
        patientId: row.patient_id,
        contactId: row.id,
        patientName,
      })
      if (result.sent > 0) {
        Alert.alert('Test sent', `Sent to ${row.name}. Check their LINE chat.`)
      } else if (result.failed > 0) {
        Alert.alert('Send failed', 'LINE rejected the message. Check the channel access token in Supabase secrets.')
      } else {
        Alert.alert('Nothing sent', 'No matching contact had a LINE userId.')
      }
    } catch (err) {
      Alert.alert('Send failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusyContactId(null)
    }
  }

  const removeContact = (row: FamilyContactsRow) => {
    Alert.alert(
      'Remove contact',
      `Remove ${row.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (USE_MOCK) {
              Alert.alert('Mock mode', 'Contact would be deleted in live mode.')
              return
            }
            const { error } = await supabase.from('family_contacts').delete().eq('id', row.id)
            if (error) Alert.alert('Delete failed', error.message)
            else await load()
          },
        },
      ],
    )
  }

  if (!patientId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F4EE', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ fontSize: 16, color: '#2F2D2B', textAlign: 'center' }}>
          Open this screen from a patient profile to manage their family contacts.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 18, minHeight: 48, paddingHorizontal: 22, borderRadius: 999, backgroundColor: '#F2A24B', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#2E2C2A', fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F4EE' }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={['#FFF7ED', '#FBD7A8', '#F3A449']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 28 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.55)' }}
          >
            <Ionicons name="chevron-back" size={26} color="#2F2D2B" />
          </Pressable>
          <Pressable
            onPress={() => setEditor({ ...EMPTY_DRAFT })}
            style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
          >
            <Ionicons name="add" size={18} color="#2F2D2B" />
            <Text style={{ marginLeft: 6, fontSize: 14, fontWeight: '600', color: '#2F2D2B' }}>Add contact</Text>
          </Pressable>
        </View>
        <Text style={{ marginTop: 18, fontSize: 28, lineHeight: 34, fontWeight: '700', color: '#2F2D2B' }}>
          Family contacts
        </Text>
        <Text style={{ marginTop: 6, fontSize: 15, lineHeight: 21, color: '#5C554E' }}>
          For {patientName}
        </Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#ED9A41" />
          </View>
        ) : contacts.length === 0 ? (
          <View
            style={{
              paddingVertical: 36,
              paddingHorizontal: 24,
              borderRadius: 22,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
            }}
          >
            <Ionicons name="people-outline" size={32} color="#B8A08A" />
            <Text style={{ marginTop: 14, fontSize: 17, fontWeight: '600', color: '#2F2D2B' }}>
              No contacts yet
            </Text>
            <Text style={{ marginTop: 6, textAlign: 'center', fontSize: 14, lineHeight: 20, color: '#857E76' }}>
              Add at least one family contact so caregivers can send LINE emergency alerts.
            </Text>
          </View>
        ) : (
          contacts.map((row) => (
            <View
              key={row.id}
              style={{
                marginBottom: 12,
                padding: 16,
                borderRadius: 18,
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#EFE4D5',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#2F2D2B' }}>{row.name}</Text>
                  {row.relationship ? (
                    <Text style={{ marginTop: 2, fontSize: 13, color: '#7B746C' }}>{row.relationship}</Text>
                  ) : null}
                  {row.phone ? (
                    <Text style={{ marginTop: 6, fontSize: 13, color: '#5C554E' }}>📞 {row.phone}</Text>
                  ) : null}
                  {row.line_user_id ? (
                    <Text style={{ marginTop: 4, fontSize: 13, color: '#1B5E20' }}>
                      ✅ LINE linked
                    </Text>
                  ) : (
                    <Text style={{ marginTop: 4, fontSize: 13, color: '#857E76' }}>
                      LINE not linked yet
                    </Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => setEditor(fromRow(row))}
                    style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#FFF3E5', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#8E4B14' }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeContact(row)}
                    style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#FBE4E1', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#A3322A' }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                {row.line_user_id ? (
                  <TouchableOpacity
                    onPress={() => handleSendTest(row)}
                    disabled={busyContactId === row.id}
                    style={{ flex: 1, minHeight: 40, borderRadius: 12, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', opacity: busyContactId === row.id ? 0.6 : 1 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1B5E20' }}>
                      {busyContactId === row.id ? 'Sending…' : 'Send LINE test'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => openInvite(row)}
                    style={{ flex: 1, minHeight: 40, borderRadius: 12, backgroundColor: '#FFF3E5', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#8E4B14' }}>
                      Show LINE invite QR
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

          ))
        )}
      </ScrollView>

      <Modal
        visible={!!editor}
        transparent
        animationType="slide"
        onRequestClose={closeEditor}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable onPress={closeEditor} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => {}} style={{ backgroundColor: '#FFF9F2', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#8E4B14', letterSpacing: 1, textTransform: 'uppercase' }}>
                {editor?.id ? 'Edit Contact' : 'Add Contact'}
              </Text>
              <Text style={{ marginTop: 6, fontSize: 22, fontWeight: '700', color: '#2E241B' }}>
                Family contact details
              </Text>

              {editor ? (
                <ScrollView style={{ marginTop: 16, maxHeight: 420 }}>
                  <FieldLabel>Name *</FieldLabel>
                  <FieldInput
                    value={editor.name}
                    onChangeText={(v) => setEditor({ ...editor, name: v })}
                    placeholder="e.g. Pranee Som"
                  />

                  <FieldLabel>Relationship</FieldLabel>
                  <FieldInput
                    value={editor.relationship}
                    onChangeText={(v) => setEditor({ ...editor, relationship: v })}
                    placeholder="Daughter, Son, Spouse..."
                  />

                  <FieldLabel>Phone</FieldLabel>
                  <FieldInput
                    value={editor.phone}
                    onChangeText={(v) => setEditor({ ...editor, phone: v })}
                    placeholder="08x-xxx-xxxx"
                    keyboardType="phone-pad"
                  />

                  <FieldLabel>LINE user ID</FieldLabel>
                  <FieldInput
                    value={editor.line_user_id}
                    onChangeText={(v) => setEditor({ ...editor, line_user_id: v })}
                    placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    autoCapitalize="none"
                  />
                </ScrollView>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={closeEditor}
                  disabled={saving}
                  style={{ flex: 1, minHeight: 50, borderRadius: 18, borderWidth: 1, borderColor: '#EADBCB', backgroundColor: '#FFFDF8', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#2E241B' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveDraft}
                  disabled={saving}
                  style={{ flex: 1, minHeight: 50, borderRadius: 18, backgroundColor: '#F2A24B', alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.7 : 1 }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#2E2C2A' }}>
                    {saving ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={!!inviteFor}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteFor(null)}
      >
        <Pressable
          onPress={() => setInviteFor(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <Pressable
            onPress={() => {}}
            style={{ width: '100%', maxWidth: 360, backgroundColor: '#FFF9F2', borderRadius: 28, padding: 24, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#8E4B14', letterSpacing: 1, textTransform: 'uppercase' }}>
              LINE Invite
            </Text>
            <Text style={{ marginTop: 6, fontSize: 20, fontWeight: '700', color: '#2E241B', textAlign: 'center' }}>
              For {inviteFor?.name ?? ''}
            </Text>
            <Text style={{ marginTop: 4, fontSize: 13, color: '#7B746C', textAlign: 'center' }}>
              Patient: {patientName}
            </Text>

            <View style={{ marginTop: 18, padding: 14, backgroundColor: '#FFFFFF', borderRadius: 18 }}>
              {inviteFor && LINE_OA_BASIC_ID ? (
                <QRCode
                  value={buildFamilyInviteUrl({ oaBasicId: LINE_OA_BASIC_ID, linkToken: inviteFor.link_token })}
                  size={220}
                  backgroundColor="#FFFFFF"
                  color="#2E241B"
                />
              ) : null}
            </View>

            <Text style={{ marginTop: 16, fontSize: 13, lineHeight: 19, color: '#5C554E', textAlign: 'center' }}>
              Have {inviteFor?.name ?? 'them'} scan this QR with the LINE app. They&apos;ll be prompted to add the PILLo OA, then to send the auto-filled message. They&apos;ll show up as ✅ LINE linked once it&apos;s done.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, alignSelf: 'stretch' }}>
              <TouchableOpacity
                onPress={() => setInviteFor(null)}
                style={{ flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#EADBCB', backgroundColor: '#FFFDF8', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#2E241B' }}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => inviteFor && shareInvite(inviteFor)}
                style={{ flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: '#F2A24B', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#2E2C2A' }}>Share link</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ marginTop: 12, marginBottom: 6, fontSize: 12, fontWeight: '600', color: '#5E5145' }}>
      {children}
    </Text>
  )
}

function FieldInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor="#B0A89E"
      {...props}
      style={[{
        minHeight: 48,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#EADBCB',
        backgroundColor: '#FFFDF8',
        fontSize: 14,
        color: '#2E241B',
      }, props.style]}
    />
  )
}
