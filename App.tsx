import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { supabase } from './lib/supabase';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      setError(profileError.message);
      return;
    }

    setProfile(profileData);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  if (profile) {
    return (
      <View style={styles.container}>
        <Text>Logged in as: {profile.email}</Text>
        <Text>Role: {profile.role}</Text>
        <Text>School ID: {profile.school_id}</Text>
        <Button title="Log out" onPress={handleLogout} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />
      <Button title="Log in" onPress={handleLogin} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, gap: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  error: { color: 'red' },
});