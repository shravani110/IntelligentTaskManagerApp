import React from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {TaskManagerScreen} from './src/screens/TaskManagerScreen';

function App() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7FB" />
      <TaskManagerScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
});

export default App;
