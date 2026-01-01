/**
 * Retrieval Agent
 *
 * Отвечает за поиск релевантных chunks из базы знаний.
 * Использует существующий searchService.
 */

import { AgentStateType } from './state';
import { searchService } from '../searchService';
import { indexedDB } from '../indexedDBService';
import { AgentChunk } from '../../types';

/**
 * Retrieval Node
 *
 * Загружает chunks из IndexedDB и фильтрует по релевантности
 */
export async function retrievalAgent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  console.log('📚 Retrieval Agent: Searching knowledge base...');

  try {
    // Load all chunks from IndexedDB
    const allChunks = await indexedDB.getAllChunks();
    console.log(`   Total chunks available: ${allChunks.length}`);

    if (allChunks.length === 0) {
      console.warn('   ⚠️ No chunks in IndexedDB');
      return { retrievedChunks: [] };
    }

    // Search for relevant chunks
    // Use 'general' department for broad search, agents will filter further
    const relevantChunks = searchService.searchChunksInMemory(
      allChunks,
      state.currentQuery,
      'general',
      15 // Top-15 chunks for multi-agent distribution
    );

    console.log(`   ✅ Found ${relevantChunks.length} relevant chunks`);

    // Convert to AgentChunk format
    const agentChunks: AgentChunk[] = relevantChunks.map(chunk => ({
      id: chunk.id,
      sourceId: chunk.sourceId,
      citation: chunk.citation,
      path: chunk.path,
      content: chunk.content,
      chunkType: chunk.chunkType
    }));

    // Log found documents
    const citations = [...new Set(agentChunks.map(c => c.citation))];
    console.log(`   Documents: ${citations.join(', ')}`);

    return {
      retrievedChunks: agentChunks
    };

  } catch (error) {
    console.error('   ❌ Retrieval Error:', error);
    return { retrievedChunks: [] };
  }
}
