import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Switch, Text, TextInput, View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

const KEY = 'sap_items_v1';
const COLORS = {
  bg: '#F5F6FC', ink: '#191A2E', muted: '#777B91', purple: '#6D5CE8',
  pale: '#EFEDFF', white: '#FFFFFF', line: '#ECECF3', green: '#1E9B75',
  orange: '#E58A35', pink: '#D65B91', navy: '#252642'
};
const TYPES = ['Class', 'CT', 'Assignment', 'Presentation', 'Special event'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false
  })
});

function dateLabel(value) {
  if (!value) return 'No date';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function timeLabel(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export default function App() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('Home');
  const [modal, setModal] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'Assignment', subject: '', date: '', time: '', place: '', notes: '', reminder: true });
  const [permission, setPermission] = useState('unknown');

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) setItems(JSON.parse(raw));
        if (Platform.OS !== 'web') {
          const p = await Notifications.getPermissionsAsync();
          setPermission(p.status);
          if (p.status !== 'granted') {
            const req = await Notifications.requestPermissionsAsync();
            setPermission(req.status);
          }
          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('academic-reminders', {
              name: 'Academic reminders',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              sound: 'default'
            });
          }
        } else {
          setPermission('browser');
        }
      } catch (e) { console.warn(e); }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(console.warn);
  }, [items, loaded]);

  const upcoming = useMemo(() => [...items].filter(x => !x.done).sort((a,b) => {
    const da = a.date ? new Date(`${a.date}T${a.time || '23:59'}`).getTime() : Infinity;
    const db = b.date ? new Date(`${b.date}T${b.time || '23:59'}`).getTime() : Infinity;
    return da-db;
  }), [items]);
  const today = new Date().toISOString().slice(0,10);
  const todayItems = upcoming.filter(x => x.date === today);
  const pending = items.filter(x => !x.done).length;

  async function scheduleReminder(item) {
    if (!item.date) return;
    const dt = new Date(`${item.date}T${item.time || '09:00'}:00`);
    if (Number.isNaN(dt.getTime()) || dt.getTime() <= Date.now()) return;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const p = await window.Notification.requestPermission();
        if (p === 'granted') {
          // Browser notifications require an active page/service worker; no guaranteed closed-browser alarm.
          new window.Notification(`Reminder: ${item.title}`, { body: `${item.type}${item.subject ? ' • '+item.subject : ''}` });
        }
      }
      return;
    }
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Academic reminder: ${item.title}`,
          body: `${item.type}${item.subject ? ' • '+item.subject : ''}${item.notes ? '\n'+item.notes : ''}`,
          sound: 'default',
          data: { itemId: item.id }
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dt }
      });
    } catch (e) { Alert.alert('Reminder not scheduled', 'Please check notification and alarm permissions.'); }
  }

  async function saveItem() {
    if (!form.title.trim()) { Alert.alert('Add a title', 'Please enter a title for this activity.'); return; }
    if (!form.date) { Alert.alert('Add a date', 'Please enter a date in YYYY-MM-DD format.'); return; }
    const item = { ...form, id: uid(), done: false };
    setItems(old => [item, ...old]);
    if (form.reminder) await scheduleReminder(item);
    setModal(false);
    setForm({ title: '', type: 'Assignment', subject: '', date: '', time: '', place: '', notes: '', reminder: true });
  }
  function toggleDone(id) { setItems(old => old.map(x => x.id === id ? { ...x, done: !x.done } : x)); }
  function removeItem(id) {
    Alert.alert('Delete activity?', 'This will remove it from your planner.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setItems(old => old.filter(x => x.id !== id)) }
    ]);
  }

  const typeColor = type => type === 'Class' ? COLORS.purple : type === 'CT' ? COLORS.orange : type === 'Assignment' ? COLORS.green : type === 'Presentation' ? COLORS.pink : COLORS.navy;
  const Field = ({ label, children }) => <View style={s.field}><Text style={s.fieldLabel}>{label}</Text>{children}</View>;
  const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;

  function ItemCard({ item }) {
    return <View style={s.itemCard}>
      <View style={[s.typeBar, { backgroundColor: typeColor(item.type) }]} />
      <View style={{ flex: 1 }}>
        <View style={s.itemTop}>
          <Text style={s.itemTitle}>{item.title}</Text>
          <Pressable onPress={() => toggleDone(item.id)} style={[s.doneButton, item.done && s.doneActive]}>
            <Text style={[s.doneText, item.done && { color: '#fff' }]}>{item.done ? 'Done' : 'Mark done'}</Text>
          </Pressable>
        </View>
        <Text style={s.itemMeta}>{item.type}{item.subject ? `  •  ${item.subject}` : ''}</Text>
        <Text style={s.itemDate}>{dateLabel(item.date)}{item.time ? `  ·  ${item.time}` : ''}{item.place ? `  ·  ${item.place}` : ''}</Text>
        {!!item.notes && <Text style={s.itemNotes}>{item.notes}</Text>}
        <Pressable onPress={() => removeItem(item.id)}><Text style={s.deleteText}>Delete</Text></Pressable>
      </View>
    </View>;
  }

  function Home() {
    return <ScrollView contentContainerStyle={s.content}>
      <View style={s.hero}>
        <Text style={s.eyebrow}>YOUR PERSONAL ACADEMIC ASSISTANT</Text>
        <Text style={s.heroTitle}>Stay ahead.{'\n'}Make every class count.</Text>
        <Text style={s.heroSub}>Your semester, beautifully organized.</Text>
        <Pressable style={s.heroButton} onPress={() => setModal(true)}><Text style={s.heroButtonText}>＋ Add new activity</Text></Pressable>
      </View>
      <View style={s.stats}>
        <Card style={s.statCard}><Text style={s.statNumber}>{todayItems.length}</Text><Text style={s.statLabel}>Today</Text></Card>
        <Card style={s.statCard}><Text style={s.statNumber}>{pending}</Text><Text style={s.statLabel}>Pending</Text></Card>
        <Card style={s.statCard}><Text style={s.statNumber}>{items.filter(x => x.type === 'Assignment' && !x.done).length}</Text><Text style={s.statLabel}>Assignments</Text></Card>
      </View>
      <View style={s.sectionHead}><Text style={s.sectionTitle}>Coming up</Text><Pressable onPress={() => setTab('Planner')}><Text style={s.link}>See all</Text></Pressable></View>
      {upcoming.slice(0,4).map(item => <ItemCard key={item.id} item={item} />)}
      {upcoming.length === 0 && <Card><Text style={s.emptyTitle}>Your planner is clear ✨</Text><Text style={s.muted}>Add a class, CT, assignment or presentation to get started.</Text></Card>}
    </ScrollView>;
  }

  function Planner() {
    return <ScrollView contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>My planner</Text>
      <Text style={s.pageSub}>Every deadline and important moment in one place.</Text>
      <View style={s.chips}>{['All', ...TYPES].map(t => <Pressable key={t} onPress={() => setFilter(t)} style={[s.chip, filter === t && s.chipActive]}><Text style={[s.chipText, filter === t && s.chipTextActive]}>{t}</Text></Pressable>)}</View>
      {upcoming.filter(x => filter === 'All' || x.type === filter).map(item => <ItemCard key={item.id} item={item} />)}
      {upcoming.filter(x => filter === 'All' || x.type === filter).length === 0 && <Card><Text style={s.muted}>Nothing here yet. Add your first activity.</Text></Card>}
    </ScrollView>;
  }

  const [filter, setFilter] = useState('All');
  function Routine() {
    const classes = items.filter(x => x.type === 'Class');
    return <ScrollView contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Class routine</Text>
      <Text style={s.pageSub}>Add each weekly class as a repeating schedule or a dated class for now.</Text>
      {DAYS.map(day => {
        const dayItems = classes.filter(x => x.day === day);
        return <Card key={day} style={{ marginBottom: 10 }}>
          <Text style={s.dayTitle}>{day}</Text>
          {dayItems.length ? dayItems.map(x => <View key={x.id} style={s.routineRow}><Text style={s.routineTime}>{x.time || 'Time TBD'}</Text><View style={{ flex:1 }}><Text style={s.itemTitle}>{x.title}</Text><Text style={s.itemMeta}>{x.subject} {x.place ? '• '+x.place : ''}</Text></View></View>) : <Text style={s.muted}>No classes added</Text>}
        </Card>;
      })}
    </ScrollView>;
  }

  function Settings() {
    return <ScrollView contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Settings</Text>
      <Card>
        <Text style={s.sectionTitle}>Reminder permissions</Text>
        <Text style={s.itemMeta}>Status: {permission === 'granted' ? 'Notifications allowed' : permission === 'browser' ? 'Browser notification support varies' : permission}</Text>
        <Text style={s.muted}>On Android, allow notifications for scheduled reminders. For reliable alarm-clock behavior (including exact alarms and alarms after a reboot), a native Android AlarmManager implementation and additional permission handling are required.</Text>
      </Card>
      <Card>
        <Text style={s.sectionTitle}>Your data</Text>
        <Text style={s.muted}>Your activities are currently saved locally on this device. Cloud sync and account login can be added in the next version.</Text>
      </Card>
      <Card>
        <Text style={s.sectionTitle}>About</Text>
        <Text style={s.muted}>Student Academic Planner · Version 1.0 starter</Text>
      </Card>
    </ScrollView>;
  }

  return <SafeAreaView style={s.safe}>
    <ExpoStatusBar style="dark" />
    <View style={s.header}><View><Text style={s.brand}>STUDY<Text style={{color: COLORS.purple}}>FLOW</Text></Text><Text style={s.headerSub}>ACADEMIC PLANNER</Text></View><View style={s.avatar}><Text style={s.avatarText}>S</Text></View></View>
    {tab === 'Home' ? <Home /> : tab === 'Planner' ? <Planner /> : tab === 'Routine' ? <Routine /> : <Settings />}
    <View style={s.bottom}>
      {[['Home','⌂'],['Planner','▤'],['Routine','▦'],['Settings','⚙']].map(([name, icon]) => <Pressable key={name} onPress={() => setTab(name)} style={s.navItem}><Text style={[s.navIcon, tab === name && { color: COLORS.purple }]}>{icon}</Text><Text style={[s.navText, tab === name && { color: COLORS.purple, fontWeight: '800' }]}>{name}</Text></Pressable>)}
    </View>
    <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
      <View style={s.modalShade}><View style={s.modal}>
        <View style={s.modalHead}><Text style={s.modalTitle}>Add activity</Text><Pressable onPress={() => setModal(false)}><Text style={s.close}>✕</Text></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Field label="Activity title *"><TextInput style={s.input} placeholder="e.g. Data Structures CT" value={form.title} onChangeText={v => setForm({...form,title:v})} /></Field>
          <Field label="Category"><View style={s.typeWrap}>{TYPES.map(t => <Pressable key={t} onPress={() => setForm({...form,type:t})} style={[s.typeChoice, form.type===t && { backgroundColor: COLORS.pale, borderColor: COLORS.purple }]}><Text style={[s.typeChoiceText, form.type===t && {color:COLORS.purple}]}>{t}</Text></Pressable>)}</View></Field>
          <Field label="Subject / course"><TextInput style={s.input} placeholder="e.g. CSE 2201" value={form.subject} onChangeText={v => setForm({...form,subject:v})} /></Field>
          <Field label="Date (YYYY-MM-DD) *"><TextInput style={s.input} placeholder="2026-11-20" value={form.date} onChangeText={v => setForm({...form,date:v})} /></Field>
          <Field label="Time (24-hour, optional)"><TextInput style={s.input} placeholder="10:30" value={form.time} onChangeText={v => setForm({...form,time:v})} /></Field>
          {form.type === 'Class' && <Field label="Weekly day (optional)"><View style={s.typeWrap}>{DAYS.map(d => <Pressable key={d} onPress={() => setForm({...form,day:d})} style={[s.typeChoice,form.day===d && {backgroundColor:COLORS.pale,borderColor:COLORS.purple}]}><Text style={s.typeChoiceText}>{d}</Text></Pressable>)}</View></Field>}
          <Field label="Room / location"><TextInput style={s.input} placeholder="e.g. Room 502" value={form.place} onChangeText={v => setForm({...form,place:v})} /></Field>
          <Field label="Notes"><TextInput style={[s.input,{height:78,textAlignVertical:'top'}]} multiline placeholder="Details, topics, instructions..." value={form.notes} onChangeText={v => setForm({...form,notes:v})} /></Field>
          <View style={s.reminderRow}><View style={{flex:1}}><Text style={s.fieldLabel}>Set a reminder</Text><Text style={s.muted}>At the activity date and time</Text></View><Switch value={form.reminder} onValueChange={v=>setForm({...form,reminder:v})} trackColor={{true:COLORS.purple}} /></View>
          <Pressable style={s.saveButton} onPress={saveItem}><Text style={s.saveText}>Save to my planner</Text></Pressable>
        </ScrollView>
      </View></View>
    </Modal>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.bg,paddingTop:Platform.OS==='android'?StatusBar.currentHeight:0},
  header:{height:70,paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:COLORS.white,borderBottomWidth:1,borderColor:COLORS.line},
  brand:{fontSize:19,fontWeight:'900',letterSpacing:1.4,color:COLORS.ink}, headerSub:{fontSize:9,letterSpacing:2,color:COLORS.muted,marginTop:2},
  avatar:{width:38,height:38,borderRadius:14,backgroundColor:COLORS.pale,alignItems:'center',justifyContent:'center'},avatarText:{fontWeight:'900',color:COLORS.purple,fontSize:16},
  content:{padding:20,paddingBottom:35,maxWidth:900,width:'100%',alignSelf:'center'},
  hero:{backgroundColor:COLORS.navy,borderRadius:25,padding:25,marginBottom:16,overflow:'hidden'},
  eyebrow:{fontSize:9,fontWeight:'800',letterSpacing:2,color:'#B9B4FF',marginBottom:15},
  heroTitle:{fontSize:31,fontWeight:'900',lineHeight:37,color:'#fff'},heroSub:{fontSize:13,color:'#C7C7DA',marginTop:10},
  heroButton:{alignSelf:'flex-start',backgroundColor:'#8173F2',paddingVertical:12,paddingHorizontal:17,borderRadius:13,marginTop:22},
  heroButtonText:{color:'#fff',fontWeight:'800',fontSize:12},
  stats:{flexDirection:'row',gap:10,marginBottom:25},card:{backgroundColor:COLORS.white,borderRadius:18,padding:17,borderWidth:1,borderColor:COLORS.line},
  statCard:{flex:1,padding:15},statNumber:{fontSize:25,fontWeight:'900',color:COLORS.ink},statLabel:{fontSize:11,color:COLORS.muted,marginTop:4},
  sectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12},sectionTitle:{fontSize:17,fontWeight:'900',color:COLORS.ink},link:{color:COLORS.purple,fontWeight:'800',fontSize:12},
  itemCard:{backgroundColor:COLORS.white,borderRadius:16,padding:14,marginBottom:10,flexDirection:'row',gap:12,borderWidth:1,borderColor:COLORS.line},
  typeBar:{width:4,borderRadius:5},itemTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},itemTitle:{fontSize:13,fontWeight:'800',color:COLORS.ink,flexShrink:1},
  itemMeta:{fontSize:11,color:COLORS.muted,marginTop:5},itemDate:{fontSize:11,color:COLORS.purple,fontWeight:'700',marginTop:7},itemNotes:{fontSize:11,color:COLORS.muted,marginTop:6},
  doneButton:{paddingVertical:6,paddingHorizontal:9,borderRadius:8,backgroundColor:COLORS.pale},doneActive:{backgroundColor:COLORS.green},doneText:{fontSize:10,fontWeight:'800',color:COLORS.purple},deleteText:{fontSize:10,color:'#C65B67',marginTop:8},
  emptyTitle:{fontSize:15,fontWeight:'800',color:COLORS.ink,marginBottom:6},muted:{fontSize:12,color:COLORS.muted,lineHeight:19,marginTop:5},
  pageTitle:{fontSize:27,fontWeight:'900',color:COLORS.ink},pageSub:{fontSize:12,color:COLORS.muted,marginTop:6,marginBottom:20},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:15},chip:{paddingVertical:8,paddingHorizontal:12,borderRadius:30,backgroundColor:'#fff',borderWidth:1,borderColor:COLORS.line},chipActive:{backgroundColor:COLORS.purple,borderColor:COLORS.purple},chipText:{fontSize:10,color:COLORS.muted,fontWeight:'700'},chipTextActive:{color:'#fff'},
  dayTitle:{fontSize:14,fontWeight:'900',color:COLORS.ink,marginBottom:10},routineRow:{flexDirection:'row',gap:12,paddingVertical:10,borderTopWidth:1,borderColor:COLORS.line},routineTime:{fontSize:11,color:COLORS.purple,fontWeight:'800',width:75},
  bottom:{height:66,backgroundColor:'#fff',borderTopWidth:1,borderColor:COLORS.line,flexDirection:'row',justifyContent:'space-around',alignItems:'center'},
  navItem:{alignItems:'center',justifyContent:'center',minWidth:55},navIcon:{fontSize:20,color:'#A0A1B2'},navText:{fontSize:10,color:COLORS.muted,marginTop:2},
  modalShade:{flex:1,backgroundColor:'rgba(16,17,37,.48)',justifyContent:'flex-end'},modal:{backgroundColor:COLORS.bg,borderTopLeftRadius:25,borderTopRightRadius:25,padding:20,maxHeight:'92%'},
  modalHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:15},modalTitle:{fontSize:21,fontWeight:'900',color:COLORS.ink},close:{fontSize:20,color:COLORS.muted,padding:5},
  field:{marginBottom:13},fieldLabel:{fontSize:11,fontWeight:'800',color:COLORS.ink,marginBottom:7},input:{backgroundColor:'#fff',borderWidth:1,borderColor:COLORS.line,borderRadius:12,padding:12,fontSize:13,color:COLORS.ink},
  typeWrap:{flexDirection:'row',flexWrap:'wrap',gap:7},typeChoice:{paddingVertical:8,paddingHorizontal:10,borderRadius:10,backgroundColor:'#fff',borderWidth:1,borderColor:COLORS.line},typeChoiceText:{fontSize:10,fontWeight:'700',color:COLORS.muted},
  reminderRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:10},saveButton:{backgroundColor:COLORS.purple,padding:15,borderRadius:13,alignItems:'center',marginTop:8,marginBottom:20},saveText:{fontSize:13,color:'#fff',fontWeight:'900'}
});