import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { chatService } from 'services/chatService';
import { Colors } from 'constants/theme';
import type { ChatSession, ChatMessage } from 'types';

export default function ChatScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(params.sessionId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await chatService.getSessions();
      setSessions(res.data || []);
    } catch { } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, []);

  const sendMessage = async () => {
    if (!input.trim() || !activeSession) return;
    const text = input.trim();
    setInput('');
    try {
      await chatService.sendMessage(activeSession, text);
      // Optimistic update
      setMessages((prev) => [
        ...prev,
        {
          _id: Date.now().toString(),
          content: text,
          content_type: 'text',
          sender_type: 'store',
          sent_at: new Date().toISOString(),
        },
      ]);
    } catch { }
  };

  const acceptChat = async (sessionId: string) => {
    try {
      await chatService.acceptChat(sessionId);
      setActiveSession(sessionId);
      fetchSessions();
    } catch { }
  };

  // Session List View
  if (!activeSession) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center px-4 py-3 bg-white border-b border-divider">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-textPrimary">Customer Chat</Text>
        </View>

        <FlatList
          data={sessions}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                if (item.status === 'waiting') {
                  acceptChat(item._id);
                } else {
                  setActiveSession(item._id);
                }
              }}
              className="bg-white px-4 py-3.5 border-b border-divider flex-row items-center"
            >
              <View className="w-10 h-10 rounded-full bg-primary items-center justify-center mr-3">
                <Text className="text-white font-bold">{item.customer?.name?.[0] || 'C'}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-textPrimary">
                  {item.customer?.name || 'Customer'}
                </Text>
                {item.last_message && (
                  <Text className="text-xs text-textSecondary mt-0.5" numberOfLines={1}>
                    {item.last_message.content}
                  </Text>
                )}
              </View>
              <View
                className="px-2 py-1 rounded-full"
                style={{
                  backgroundColor:
                    item.status === 'waiting'
                      ? Colors.warning + '15'
                      : item.status === 'active'
                        ? Colors.success + '15'
                        : Colors.textTertiary + '15',
                }}
              >
                <Text
                  className="text-xs font-semibold capitalize"
                  style={{
                    color:
                      item.status === 'waiting'
                        ? Colors.warning
                        : item.status === 'active'
                          ? Colors.success
                          : Colors.textTertiary,
                  }}
                >
                  {item.status}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View className="items-center py-20">
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.textTertiary} />
              <Text className="text-textTertiary mt-3">No chat sessions</Text>
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  // Chat Messages View
  const session = sessions.find((s) => s._id === activeSession);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-divider">
        <TouchableOpacity onPress={() => setActiveSession(null)} className="mr-3">
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-textPrimary flex-1">
          {session?.customer?.name || 'Chat'}
        </Text>
        {session?.status === 'active' && (
          <TouchableOpacity
            onPress={async () => {
              await chatService.endChat(activeSession);
              setActiveSession(null);
              fetchSessions();
            }}
          >
            <Text className="text-error text-sm font-medium">End Chat</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View
            className="mx-4 my-1 max-w-[80%] px-3 py-2 rounded-2xl"
            style={{
              alignSelf: item.sender_type === 'store' ? 'flex-end' : 'flex-start',
              backgroundColor: item.sender_type === 'store' ? Colors.primary : '#fff',
            }}
          >
            <Text
              className="text-sm"
              style={{ color: item.sender_type === 'store' ? '#fff' : Colors.textPrimary }}
            >
              {item.content}
            </Text>
            <Text
              className="text-[10px] mt-0.5"
              style={{
                color: item.sender_type === 'store' ? 'rgba(255,255,255,0.7)' : Colors.textTertiary,
              }}
            >
              {new Date(item.sent_at).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        contentContainerStyle={{ paddingVertical: 10 }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center px-4 py-2 bg-white border-t border-divider">
          <TextInput
            className="flex-1 bg-background rounded-full px-4 py-2.5 text-sm text-textPrimary mr-2"
            placeholder="Type a message..."
            placeholderTextColor={Colors.textTertiary}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity
            onPress={sendMessage}
            className="w-10 h-10 rounded-full bg-primary items-center justify-center"
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
