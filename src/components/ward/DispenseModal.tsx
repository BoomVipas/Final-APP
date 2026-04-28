import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { emergencyStop, type DispenseProgressEvent } from '../../lib/moonraker'
import { type DispenseJob, type DispenseModalPhase } from './types'

interface DispenseModalProps {
  visible: boolean
  jobs: DispenseJob[]
  timeLabel: string
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function DispenseModal({ visible, jobs, timeLabel, onClose, onConfirm }: DispenseModalProps) {
  const [phase, setPhase]       = useState<DispenseModalPhase>('confirm')
  const [events, setEvents]     = useState<DispenseProgressEvent[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const scrollRef               = useRef<ScrollView>(null)

  useEffect(() => {
    if (visible) { setPhase('confirm'); setEvents([]); setErrorMsg('') }
  }, [visible])

  const handleStart = async () => {
    setPhase('running')
    setEvents([])
    try {
      await onConfirm()
      setPhase('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Dispense failed')
      setPhase('error')
    }
  }

  const totalTablets = jobs.reduce((s, j) => s + j.tablets, 0)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50" onPress={phase === 'confirm' ? onClose : undefined}>
        <View className="flex-1" />
        <Pressable onPress={() => {}} className="bg-[#FFF9F2] rounded-t-[32px] px-5 pt-6 pb-8" style={{ maxHeight: '85%' }}>

          {/* ── Confirm ── */}
          {phase === 'confirm' && (
            <>
              <View className="flex-row items-center justify-between mb-5">
                <View>
                  <Text className="text-xs font-semibold uppercase tracking-widest text-[#8E4B14]">PILLo Dispenser</Text>
                  <Text className="text-xl font-bold text-[#2E241B] mt-0.5">Confirm Dispense</Text>
                </View>
                <TouchableOpacity onPress={onClose} className="w-9 h-9 rounded-full bg-[#F0E8DE] items-center justify-center">
                  <Ionicons name="close" size={18} color="#5E5145" />
                </TouchableOpacity>
              </View>

              <View className="flex-row gap-3 mb-5">
                <View className="flex-1 bg-[#F6EBDD] rounded-2xl px-3 py-3 items-center">
                  <Text className="text-xl font-bold text-[#2E241B]">{jobs.length}</Text>
                  <Text className="text-xs text-[#7D6E60] mt-0.5">Patients</Text>
                </View>
                <View className="flex-1 bg-[#F6EBDD] rounded-2xl px-3 py-3 items-center">
                  <Text className="text-xl font-bold text-[#2E241B]">{totalTablets}</Text>
                  <Text className="text-xs text-[#7D6E60] mt-0.5">Total doses</Text>
                </View>
                <View className="flex-1 bg-[#F6EBDD] rounded-2xl px-3 py-3 items-center">
                  <Text className="text-xl font-bold text-[#2E241B]">{timeLabel}</Text>
                  <Text className="text-xs text-[#7D6E60] mt-0.5">Time slot</Text>
                </View>
              </View>

              <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false} className="mb-5">
                {jobs.map((job, i) => (
                  <View key={job.patientId} className="flex-row items-center py-2.5 border-b border-[#F0E8DE]">
                    <View className="w-7 h-7 rounded-full bg-[#F6EBDD] items-center justify-center mr-3">
                      <Text className="text-xs font-bold text-[#8E4B14]">{i + 1}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-[#2E241B]">{job.patientName}</Text>
                      <Text className="text-xs text-[#7D6E60]">Room {job.room} · Slot {job.cabinet}</Text>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons name="medical-outline" size={14} color="#C96B1A" />
                      <Text className="text-sm font-semibold text-[#C96B1A] ml-1">{job.tablets}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 mb-5 flex-row items-start">
                <Text className="text-base mr-2">⚠️</Text>
                <Text className="text-xs text-amber-700 flex-1">
                  Ensure the collection tray is in place and patients are ready before starting.
                </Text>
              </View>

              <TouchableOpacity onPress={handleStart} className="bg-[#C96B1A] rounded-2xl py-4 items-center">
                <Text className="text-white font-bold text-base">Start Dispensing</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} className="items-center py-3 mt-1">
                <Text className="text-sm text-[#7D6E60]">Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Running ── */}
          {phase === 'running' && (
            <>
              <View className="items-center mb-6">
                <View className="w-16 h-16 rounded-[20px] bg-[#FFF0E0] items-center justify-center mb-4">
                  <ActivityIndicator size="large" color="#C96B1A" />
                </View>
                <Text className="text-lg font-bold text-[#2E241B]">Dispensing in progress</Text>
                <Text className="text-xs text-[#7D6E60] mt-1">Do not move the dispenser</Text>
              </View>

              {events.length > 0 && (
                <View className="bg-[#F0E8DE] rounded-full h-2 mb-5 overflow-hidden">
                  <View
                    className="bg-[#C96B1A] h-2 rounded-full"
                    style={{ width: `${Math.min(100, (events.filter(e => e.type === 'delivering').length / jobs.length) * 100)}%` }}
                  />
                </View>
              )}

              <ScrollView ref={scrollRef} style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
                {events.map((ev, i) => (
                  <View key={i} className="flex-row items-start mb-2">
                    <Text className="text-base mr-2 mt-0.5">
                      {ev.type === 'homing' ? '🔄' : ev.type === 'moving' ? '➡️' : ev.type === 'picking' ? '🤖' : ev.type === 'delivering' ? '✅' : ev.type === 'done' ? '🎉' : '❌'}
                    </Text>
                    <Text className="text-sm text-[#2E241B] flex-1">{ev.message}</Text>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
                onPress={() => emergencyStop().then(() => setPhase('error')).catch(() => setPhase('error'))}
                className="bg-red-500 rounded-2xl py-3 items-center mt-4"
              >
                <Text className="text-white font-bold text-sm">🛑 Emergency Stop</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Done ── */}
          {phase === 'done' && (
            <View className="items-center py-6">
              <Text className="text-5xl mb-4">✅</Text>
              <Text className="text-xl font-bold text-[#2E241B] mb-1">All Done!</Text>
              <Text className="text-sm text-[#7D6E60] text-center mb-6">
                {jobs.length} patient{jobs.length !== 1 ? 's' : ''} dispensed ({totalTablets} doses)
              </Text>
              <TouchableOpacity onPress={onClose} className="bg-[#C96B1A] rounded-2xl px-10 py-3.5">
                <Text className="text-white font-bold text-base">Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Error ── */}
          {phase === 'error' && (
            <View className="items-center py-6">
              <Text className="text-5xl mb-4">❌</Text>
              <Text className="text-xl font-bold text-[#2E241B] mb-2">Dispense Failed</Text>
              <View className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-6 w-full">
                <Text className="text-sm text-red-700 text-center">{errorMsg || 'An error occurred. Check the machine and try again.'}</Text>
              </View>
              <TouchableOpacity onPress={onClose} className="bg-[#C96B1A] rounded-2xl px-10 py-3.5">
                <Text className="text-white font-bold text-base">Close</Text>
              </TouchableOpacity>
            </View>
          )}

        </Pressable>
      </Pressable>
    </Modal>
  )
}
