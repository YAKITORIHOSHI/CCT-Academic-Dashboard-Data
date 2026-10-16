import { useCallback, useEffect, useRef, useState } from 'react';
import { ref, query, onValue, orderByChild, equalTo, push, runTransaction } from 'firebase/database';
import { rtdb, auth } from '../firebase/config';
import { useAuth } from './auth';
import { AcademicDataContext } from './academicData';
import { MODULE_COLLECTIONS, PRIVATE_COLLECTIONS, GLOBAL_COLLECTIONS, validateModule, moduleIdentity, buildModuleMutation } from '../utils/academicModules';
import { firebaseCollectionRows, firebaseErrorMessage, subscribeSafely, withFirebaseReadDeadline } from '../services/firebaseSafety';

const emptyCollections = () => Object.fromEntries(MODULE_COLLECTIONS.map((collection) => [collection, []]));
export function AcademicDataProvider({ children }) {
  const { currentUser, isAuthenticated, isFirebaseConnected, permissions, departments } = useAuth();
  const [collections, setCollections] = useState(emptyCollections);
  const [departmentIds, setDepartmentIds] = useState({});
  const [sync, setSync] = useState({ loading: true, error: '', ready: [] });
  const scope = `${currentUser?.uid || ''}:${currentUser?.role || ''}:${currentUser?.department || ''}`;
  const [boundScope, setBoundScope] = useState(scope);
  const session = useRef(scope); session.current = scope;
  useEffect(() => {
    setBoundScope(scope);
    setCollections(emptyCollections()); setDepartmentIds({}); setSync({ loading: true, error: '', ready: [] });
    if (!isAuthenticated || !currentUser?.uid) return undefined;
    let disposed = false; const ready = new Set(); const errors = new Map();
    const paths = ['departments', ...MODULE_COLLECTIONS.filter((path) => !permissions.isPresident || !PRIVATE_COLLECTIONS.includes(path))];
    const updateSync = () => setSync({ loading: ready.size !== paths.length, error: [...errors.values()].join(' '), ready: [...ready] });
    const unsubscribers = paths.map((path) => {
      const createSource = () => path === 'departments' || permissions.canViewAllDepartments || GLOBAL_COLLECTIONS.includes(path) ? ref(rtdb, path)
        : query(ref(rtdb, path), orderByChild('department'), equalTo(currentUser.department));
      return subscribeSafely(onValue, createSource, (snapshot) => {
        if (disposed) return;
        if (path === 'departments') {
          setDepartmentIds(Object.fromEntries(firebaseCollectionRows(snapshot.val(), { allowStrings: true }).filter((department) => typeof department.name === 'string' && department.name.trim()).map((department) => [department.name, department.id])));
          ready.add(path); errors.delete(path); updateSync(); return;
        }
        const rows = firebaseCollectionRows(snapshot.val());
        setCollections((previous) => ({ ...previous, [path]: rows })); ready.add(path); errors.delete(path); updateSync();
      }, (error) => {
        if (disposed) return;
        if (path === 'departments') setDepartmentIds({});
        else setCollections((previous) => ({ ...previous, [path]: [] }));
        errors.set(path, firebaseErrorMessage(error)); ready.add(path); updateSync();
      });
    });
    return () => { disposed = true; unsubscribers.forEach((unsubscribe) => unsubscribe()); };
  }, [scope, isAuthenticated, currentUser?.uid, currentUser?.department, permissions.canViewAllDepartments, permissions.isPresident]);

  const saveAcademic = useCallback(async (collection, input, expected = null, remove = false) => {
    if (!isAuthenticated || !currentUser?.uid || permissions.isPresident) return { success: false, message: 'Your CCT role cannot change this data.' };
    if (!isFirebaseConnected) return { success: false, message: 'Reconnect before saving. Your form stays open.' };
    if (boundScope !== scope || !sync.ready.includes(collection) || sync.error) return { success: false, message: 'Wait for CCT data to synchronize before saving.' };
    const generation = session.current;
    try {
      const validated = validateModule(collection, input);
      if (['faculty', 'departmentHeads'].includes(collection) && !permissions.isVPAA && !permissions.isDean) throw new Error('Only the CCT VPAA or the assigned Dean can change faculty performance and Department Head assignments.');
      if (GLOBAL_COLLECTIONS.includes(collection) && !permissions.isVPAA) return { success: false, message: 'The CCT VPAA consolidates college-wide annual submissions.' };
      if (!GLOBAL_COLLECTIONS.includes(collection)) {
        if (!departments.includes(validated.department)) throw new Error('Select an existing CCT school.');
        if (!permissions.isVPAA && validated.department !== currentUser.department) throw new Error('You can change only your assigned CCT school.');
      }
      const identity = moduleIdentity(collection, validated);
      if (expected && identity !== moduleIdentity(collection, validateModule(collection, expected))) throw new Error('The identifier, school, and Academic Year cannot be changed on an existing entry. Create a new entry for a different scope.');
      let id = expected?.id;
      if (!id && (GLOBAL_COLLECTIONS.includes(collection) || ['students','faculty','retention'].includes(collection))) id = identity;
      if (!GLOBAL_COLLECTIONS.includes(collection)) {
        validated.departmentId = departmentIds[validated.department];
        if (!validated.departmentId) throw new Error('The CCT school directory is still loading.');
        if (!id && collection === 'departmentHeads') id = 'dept_' + validated.departmentId;
      }
      if (!id && identity) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
        id = 'cct_' + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2,'0')).join('');
      }
      id ||= push(ref(rtdb, collection)).key;
      if (generation !== session.current || auth.currentUser?.uid !== currentUser.uid) throw new Error('Your CCT account session changed.');
      const row = { ...validated, id, createdByUid: expected?.createdByUid || currentUser.uid,
        modifiedByUid: currentUser.uid, updatedAt: new Date().toISOString() };
      const target = ref(rtdb, `${collection}/${id}`);
      let resolveFirst; let rejectFirst;
      const first = new Promise((resolve, reject) => { resolveFirst = resolve; rejectFirst = reject; });
      const off = onValue(target, resolveFirst, rejectFirst);
      try {
        await withFirebaseReadDeadline(() => first);
        const result = await runTransaction(target, (current) => generation === session.current && auth.currentUser?.uid === currentUser.uid
          ? buildModuleMutation(row, expected, remove)(current) : undefined, { applyLocally: false });
        if (generation !== session.current) throw new Error('Your CCT account session changed.');
        if (!result.committed && expected && !result.snapshot.exists()) return { success: false, message: 'This CCT entry no longer exists. Close the form and refresh the list.' };
        if (!result.committed) return { success: false, message: expected
          ? 'This entry changed on another device. Reopen the latest entry before saving.'
          : GLOBAL_COLLECTIONS.includes(collection) ? 'An entry already exists for this Academic Year. Open it and choose Edit instead.'
            : 'This student, section, or annual entry already exists. Update the existing entry instead.' };
        return { success: true, record: result.snapshot.val() };
      } finally { off(); }
    } catch (error) {
      return { success: false, message: error?.code ? firebaseErrorMessage(error, 'save') : error?.message || 'The CCT entry could not be saved.' };
    }
  }, [isAuthenticated, currentUser, permissions.isPresident, permissions.isVPAA, permissions.isDean, isFirebaseConnected, departments, departmentIds, sync, boundScope, scope]);
  const visibleData = boundScope === scope ? { ...collections, departmentIds, sync }
    : { ...emptyCollections(), departmentIds: {}, sync: { loading: true, error: '', ready: [] } };
  return <AcademicDataContext.Provider value={{ ...visibleData, saveAcademic }}>{children}</AcademicDataContext.Provider>;
}
