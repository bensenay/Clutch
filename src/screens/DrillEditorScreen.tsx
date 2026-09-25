import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Ellipse,
  Line,
  Path,
  Polygon,
  Rect,
} from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { AppButton } from '../components/AppButton';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import { LoadingState } from '../components/LoadingState';
import { PracticeToolIcon, type PracticeToolIconName } from '../components/PracticeToolIcon';
import { RinkWatermark } from '../components/RinkWatermark';
import type { AuthenticatedStackParamList } from '../navigation/types';
import {
  isLikelyNetworkError,
  makeTeamCacheKey,
  readCache,
  updateCachedListItem,
} from '../offline/cache';
import { useActiveTeam } from '../teams/ActiveTeamContext';
import {
  colors,
  fontSizes,
  fonts,
  goalRed,
  hornAmber,
  iceWhite,
  lineHeights,
  radii,
  rinkNavy,
  sizes,
  slateGrey,
  spacing,
} from '../theme/theme';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'DrillEditor'>;

type PlacedObjectType = 'player_token' | 'puck' | 'cone' | 'net' | 'text';
type PathObjectType = 'skate_path' | 'pass_line';
type ZoneObjectType = 'shaded_zone';
type DrillObjectType = PlacedObjectType | PathObjectType | ZoneObjectType;
type PlayerTokenLabel = 'F' | 'F1' | 'F2' | 'F3' | 'D' | 'D1' | 'D2' | 'G' | 'C';
type PathStyle = 'straight' | 'curved' | 'backward' | 'freehand';
type MarkerVariant = 'single' | 'group';
type PathPoint = {
  x: number;
  y: number;
};
type ToolChoice =
  | { type: 'player_token'; color: string; label: PlayerTokenLabel }
  | { type: 'puck' | 'cone'; variant: MarkerVariant }
  | { type: 'net' }
  | { type: 'skate_path' | 'pass_line'; style: PathStyle }
  | { type: 'text' }
  | { type: 'shaded_zone' };
type PlaceToolChoice = Extract<
  ToolChoice,
  { type: 'player_token' } | { type: 'puck' | 'cone' | 'net' }
>;
type PathToolChoice = Extract<
  ToolChoice,
  { type: 'skate_path' } | { type: 'pass_line' }
>;

type PlacedDrillObject = {
  id: string;
  type: PlacedObjectType;
  x: number;
  y: number;
  color: string;
  label?: PlayerTokenLabel;
  text?: string;
  rotation: number;
  variant?: MarkerVariant;
};

type SkatePathObject = {
  id: string;
  type: 'skate_path';
  points: PathPoint[];
  color: string;
  style: PathStyle;
};

type PassLineObject = {
  id: string;
  type: 'pass_line';
  points: PathPoint[];
  color: string;
  style: PathStyle;
};

type PathDrillObject = SkatePathObject | PassLineObject;
type ShadedZoneObject = {
  id: string;
  type: 'shaded_zone';
  points: PathPoint[];
  color: string;
  opacity: number;
};
type DrillCanvasObject = PlacedDrillObject | PathDrillObject | ShadedZoneObject;

type DrillRow = {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  is_published: boolean;
  canvas_data: unknown;
  created_at: string;
  updated_at: string | null;
};

type CanvasSize = {
  width: number;
  height: number;
};

const RINK_WIDTH = 1000;
const RINK_HEIGHT = 500;
const OBJECT_SIZE = 34;
const TABLET_BREAKPOINT = 768;
const PLAYER_TOKEN_COLOR = goalRed;
const PUCK_COLOR = '#15191d';
const CONE_COLOR = hornAmber;
const NET_COLOR = '#3e5e75';
const SKATE_PATH_COLOR = goalRed;
const PASS_LINE_COLOR = '#2f68ad';
const TEXT_COLOR = rinkNavy;
const SHADED_ZONE_COLOR = hornAmber;
const SHADED_ZONE_OPACITY = 0.28;
const MIN_PATH_POINT_DISTANCE = 8;
const MAX_CANVAS_OBJECTS = 400;
const MAX_PATH_POINTS = 600;
const TOKEN_COLOR_OPTIONS = [
  goalRed,
  '#2f68ad',
  '#2f7d4f',
  hornAmber,
  '#6a4fb3',
  '#ffffff',
];

export function DrillEditorScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const windowDimensions = useWindowDimensions();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { activeTeam, isReadOnlyTeam } = useActiveTeam();
  const drillId = route.params?.drillId;
  const isReadOnly = isReadOnlyTeam || Boolean(route.params?.readOnly);
  const suppressNextCanvasPress = useRef(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [objects, setObjects] = useState<DrillCanvasObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<ToolChoice | null>(null);
  const [showPlayerChoices, setShowPlayerChoices] = useState(false);
  const [showSkateChoices, setShowSkateChoices] = useState(false);
  const [showPassChoices, setShowPassChoices] = useState(false);
  const [showPuckChoices, setShowPuckChoices] = useState(false);
  const [showConeChoices, setShowConeChoices] = useState(false);
  const [tokenColor, setTokenColor] = useState(PLAYER_TOKEN_COLOR);
  const [draftPath, setDraftPath] = useState<PathDrillObject | null>(null);
  const [draftZonePoints, setDraftZonePoints] = useState<PathPoint[]>([]);
  const [pendingText, setPendingText] = useState<{
    id?: string;
    x: number;
    y: number;
  } | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({
    width: 0,
    height: 0,
  });
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const undoStack = useRef<DrillCanvasObject[][]>([]);
  const redoStack = useRef<DrillCanvasObject[][]>([]);
  const isLandscape = windowDimensions.width > windowDimensions.height;
  const isTablet =
    (Platform.OS === 'ios' && Platform.isPad) ||
    Math.min(windowDimensions.width, windowDimensions.height) >= TABLET_BREAKPOINT;
  const useCompactLayout = isLandscape || isTablet;
  const compactAvailableWidth = Math.max(
    0,
    windowDimensions.width - spacing.md * 2,
  );
  const compactAvailableHeight = Math.max(
    0,
    windowDimensions.height * (isTablet ? 0.38 : 0.34),
  );
  const compactCanvasWidth = Math.min(
    compactAvailableWidth,
    compactAvailableHeight * (RINK_WIDTH / RINK_HEIGHT),
  );
  const compactCanvasHeight = compactCanvasWidth / (RINK_WIDTH / RINK_HEIGHT);

  const drillQuery = useQuery({
    queryKey: ['drill', drillId],
    queryFn: async () => {
      if (!drillId) {
        throw new Error(t('drillEditor.missingDrillError'));
      }

      try {
        const { data, error } = await supabase
          .from('drills')
          .select(
            'id, team_id, name, description, is_published, canvas_data, created_at, updated_at',
          )
          .eq('id', drillId)
          .single();

        if (error) {
          throw error;
        }

        const drill = data as DrillRow;

        if (activeTeam) {
          await updateCachedListItem(makeTeamCacheKey('drills', activeTeam.id), drill);
        }

        return drill;
      } catch (error) {
        if (activeTeam && isLikelyNetworkError(error)) {
          const cachedDrills = await readCache<DrillRow[]>(
            makeTeamCacheKey('drills', activeTeam.id),
          );
          const cachedDrill = cachedDrills?.data.find(
            (drill) => drill.id === drillId,
          );

          if (cachedDrill) {
            return cachedDrill;
          }
        }

        throw error;
      }
    },
    enabled: Boolean(drillId),
  });

  useEffect(() => {
    if (!drillQuery.data) {
      return;
    }

    setName(drillQuery.data.name);
    setDescription(drillQuery.data.description ?? '');
    setIsPublished(drillQuery.data.is_published);
    setObjects(normalizeCanvasData(drillQuery.data.canvas_data));
    undoStack.current = [];
    redoStack.current = [];
    setSelectedObjectId(null);
  }, [drillQuery.data]);

  const selectedObject = useMemo(
    () => objects.find((object) => object.id === selectedObjectId) ?? null,
    [objects, selectedObjectId],
  );

  function commitObjects(
    update: (currentObjects: DrillCanvasObject[]) => DrillCanvasObject[],
  ) {
    setObjects((currentObjects) => {
      const nextObjects = update(currentObjects);

      if (nextObjects === currentObjects) {
        return currentObjects;
      }

      undoStack.current = [...undoStack.current.slice(-49), currentObjects];
      redoStack.current = [];
      return nextObjects;
    });
  }

  function undo() {
    const previousObjects = undoStack.current.at(-1);

    if (!previousObjects) {
      return;
    }

    setObjects((currentObjects) => {
      redoStack.current = [...redoStack.current.slice(-49), currentObjects];
      undoStack.current = undoStack.current.slice(0, -1);
      return previousObjects;
    });
    setSelectedObjectId(null);
  }

  function redo() {
    const nextObjects = redoStack.current.at(-1);

    if (!nextObjects) {
      return;
    }

    setObjects((currentObjects) => {
      undoStack.current = [...undoStack.current.slice(-49), currentObjects];
      redoStack.current = redoStack.current.slice(0, -1);
      return nextObjects;
    });
    setSelectedObjectId(null);
  }

  function handleCanvasLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setCanvasSize({ width, height });
  }

  function handleCanvasPress(locationX: number, locationY: number) {
    if (suppressNextCanvasPress.current) {
      suppressNextCanvasPress.current = false;
      return;
    }

    if (selectedTool && isPathTool(selectedTool)) {
      return;
    }

    if (
      selectedTool?.type === 'shaded_zone' &&
      !isReadOnly &&
      canvasSize.width > 0 &&
      canvasSize.height > 0
    ) {
      setSelectedObjectId(null);
      setDraftZonePoints((currentPoints) => [
        ...currentPoints,
        toRinkPoint(locationX, locationY, canvasSize),
      ]);
      return;
    }

    if (
      selectedTool?.type === 'text' &&
      !isReadOnly &&
      canvasSize.width > 0 &&
      canvasSize.height > 0
    ) {
      setSelectedObjectId(null);
      setTextDraft('');
      setPendingText(toRinkPoint(locationX, locationY, canvasSize));
      return;
    }

    if (
      !selectedTool ||
      !isPlaceTool(selectedTool) ||
      isReadOnly ||
      canvasSize.width <= 0 ||
      canvasSize.height <= 0
    ) {
      setSelectedObjectId(null);
      return;
    }

    const nextObject = makeCanvasObject(
      selectedTool,
      toRinkX(locationX, canvasSize),
      toRinkY(locationY, canvasSize),
    );

    commitObjects((currentObjects) => [...currentObjects, nextObject]);
    setSelectedObjectId(nextObject.id);
  }

  function beginPathDrawing(locationX: number, locationY: number) {
    if (!selectedTool || !isPathTool(selectedTool) || isReadOnly) {
      return;
    }

    const firstPoint = toRinkPoint(locationX, locationY, canvasSize);
    setSelectedObjectId(null);
    setDraftPath(makePathObject(selectedTool, [firstPoint]));
  }

  function appendPathPoint(locationX: number, locationY: number) {
    if (!selectedTool || !isPathTool(selectedTool) || isReadOnly) {
      return;
    }

    const nextPoint = toRinkPoint(locationX, locationY, canvasSize);
    setDraftPath((currentPath) => {
      if (!currentPath) {
        return makePathObject(selectedTool, [nextPoint]);
      }

      const previousPoint = currentPath.points[currentPath.points.length - 1];
      if (
        previousPoint &&
        getPointDistance(previousPoint, nextPoint) < MIN_PATH_POINT_DISTANCE
      ) {
        return currentPath;
      }

      return {
        ...currentPath,
        points: [...currentPath.points, nextPoint],
      };
    });
  }

  function finishPathDrawing() {
    setDraftPath((currentPath) => {
      if (!currentPath || currentPath.points.length < 2) {
        return null;
      }

      const finalPath = {
        ...currentPath,
        points: simplifyPathPoints(currentPath),
      };

      commitObjects((currentObjects) => [...currentObjects, finalPath]);
      setSelectedObjectId(finalPath.id);

      return null;
    });
  }

  function moveObject(id: string, nextX: number, nextY: number) {
    commitObjects((currentObjects) =>
      currentObjects.map((object) =>
        object.id === id && isPlacedObject(object)
          ? {
              ...object,
              x: clamp(nextX, 0, RINK_WIDTH),
              y: clamp(nextY, 0, RINK_HEIGHT),
            }
          : object,
      ),
    );
  }

  function deleteSelectedObject() {
    if (!selectedObjectId || isReadOnly) {
      return;
    }

    commitObjects((currentObjects) =>
      currentObjects.filter((object) => object.id !== selectedObjectId),
    );
    setSelectedObjectId(null);
  }

  function markObjectInteraction() {
    suppressNextCanvasPress.current = true;
  }

  function updateObjectColor(id: string, color: string) {
    commitObjects((currentObjects) =>
      currentObjects.map((object) =>
        object.id === id ? { ...object, color } : object,
      ),
    );
  }

  function duplicateSelectedObject() {
    if (!selectedObject || isReadOnly) {
      return;
    }

    const duplicate = duplicateCanvasObject(selectedObject);
    commitObjects((currentObjects) => [...currentObjects, duplicate]);
    setSelectedObjectId(duplicate.id);
  }

  function rotateSelectedObject() {
    if (!selectedObject || isReadOnly) {
      return;
    }

    commitObjects((currentObjects) =>
      currentObjects.map((object) =>
        object.id === selectedObject.id ? rotateCanvasObject(object, 15) : object,
      ),
    );
  }

  function beginTextEdit(object: PlacedDrillObject) {
    if (object.type !== 'text' || isReadOnly) {
      return;
    }

    setSelectedObjectId(object.id);
    setTextDraft(object.text ?? '');
    setPendingText({
      id: object.id,
      x: object.x,
      y: object.y,
    });
  }

  function confirmText() {
    if (!pendingText || !textDraft.trim()) {
      return;
    }

    if (pendingText.id) {
      commitObjects((currentObjects) =>
        currentObjects.map((object) =>
          object.id === pendingText.id && isPlacedObject(object)
            ? {
                ...object,
                text: textDraft.trim(),
              }
            : object,
        ),
      );
      setSelectedObjectId(pendingText.id);
    } else {
      const textObject: PlacedDrillObject = {
        color: TEXT_COLOR,
        id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        rotation: 0,
        text: textDraft.trim(),
        type: 'text',
        x: pendingText.x,
        y: pendingText.y,
      };

      commitObjects((currentObjects) => [...currentObjects, textObject]);
      setSelectedObjectId(textObject.id);
    }

    setPendingText(null);
    setTextDraft('');
  }

  function cancelTextEdit() {
    setPendingText(null);
    setTextDraft('');
  }

  function finishShadedZone() {
    if (draftZonePoints.length < 3) {
      return;
    }

    const zone: ShadedZoneObject = {
      color: SHADED_ZONE_COLOR,
      id: `shaded_zone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      opacity: SHADED_ZONE_OPACITY,
      points: draftZonePoints,
      type: 'shaded_zone',
    };

    commitObjects((currentObjects) => [...currentObjects, zone]);
    setSelectedObjectId(zone.id);
    setDraftZonePoints([]);
  }

  function clearShadedZoneDraft() {
    setDraftZonePoints([]);
  }

  const drawGesture = Gesture.Pan()
    .enabled(
      !isReadOnly &&
        Boolean(selectedTool && isPathTool(selectedTool)) &&
        canvasSize.width > 0 &&
        canvasSize.height > 0,
    )
    .minDistance(2)
    .onBegin((event) => {
      runOnJS(beginPathDrawing)(event.x, event.y);
    })
    .onUpdate((event) => {
      runOnJS(appendPathPoint)(event.x, event.y);
    })
    .onEnd(() => {
      runOnJS(finishPathDrawing)();
    });

  async function saveDrill() {
    if (!activeTeam || !session) {
      setFormError(t('drillEditor.noActiveTeamError'));
      return;
    }

    if (!name.trim()) {
      setFormError(t('drillEditor.nameRequiredError'));
      return;
    }

    setFormError('');
    setIsSaving(true);

    try {
      if (drillId) {
        const { error } = await supabase
          .from('drills')
          .update({
            canvas_data: objects,
            description: description.trim() || null,
            is_published: isPublished,
            name: name.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', drillId);

        if (error) {
          throw error;
        }
      } else {
        const { data, error } = await supabase
          .from('drills')
          .insert({
            canvas_data: objects,
            created_by_user_id: session.user.id,
            description: description.trim() || null,
            is_published: false,
            name: name.trim(),
            team_id: activeTeam.id,
          })
          .select('id')
          .single();

        if (error) {
          throw error;
        }

        navigation.replace('DrillEditor', { drillId: data.id });
      }

      await queryClient.invalidateQueries({ queryKey: ['drills', activeTeam.id] });
      await queryClient.invalidateQueries({ queryKey: ['school-drills'] });
      if (drillId) {
        await queryClient.invalidateQueries({ queryKey: ['drill', drillId] });
      }
    } catch (error) {
      console.error('Unable to save drill:', error);
      setFormError(
        isLikelyNetworkError(error)
          ? t('offline.writeBlocked')
          : t('drillEditor.saveError'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function togglePublished() {
    if (!activeTeam || !drillId || isReadOnly || isPublishing) {
      return;
    }

    const nextPublishedState = !isPublished;
    setFormError('');
    setIsPublishing(true);

    try {
      const { error } = await supabase
        .from('drills')
        .update({
          is_published: nextPublishedState,
          updated_at: new Date().toISOString(),
        })
        .eq('id', drillId);

      if (error) {
        throw error;
      }

      setIsPublished(nextPublishedState);
      await queryClient.invalidateQueries({ queryKey: ['drills', activeTeam.id] });
      await queryClient.invalidateQueries({ queryKey: ['school-drills'] });
      await queryClient.invalidateQueries({ queryKey: ['drill', drillId] });
    } catch (error) {
      console.error('Unable to update drill publish state:', error);
      setFormError(
        isLikelyNetworkError(error)
          ? t('offline.writeBlocked')
          : t('drillEditor.publishError'),
      );
    } finally {
      setIsPublishing(false);
    }
  }

  if (!activeTeam) {
    return (
      <AppScreen
        description={t('practices.noActiveTeamDescription')}
        title={t('practices.noActiveTeamTitle')}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <RinkWatermark />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          useCompactLayout && styles.compactContent,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, useCompactLayout && styles.compactHeader]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{t('common.brand')}</Text>
            <Text style={styles.title}>
              {isReadOnly
                ? t('drillEditor.readOnlyTitle')
                : drillId
                  ? t('drillEditor.editTitle')
                  : t('drillEditor.addTitle')}
            </Text>
            {useCompactLayout ? null : (
              <Text style={styles.description}>
                {t('drillEditor.description', { teamName: activeTeam.name })}
              </Text>
            )}
          </View>
          {isReadOnly ? null : (
            <AppButton
              disabled={isSaving || drillQuery.isLoading}
              icon="save-outline"
              title={
                isSaving
                  ? t('drillEditor.savingButton')
                  : t('drillEditor.saveButton')
              }
              onPress={() => void saveDrill()}
            />
          )}
        </View>
      {useCompactLayout && !isReadOnly ? (
        <View style={styles.compactMetadata}>
          <TextInput
            accessibilityLabel={t('drillEditor.nameLabel')}
            autoCapitalize="words"
            editable={!isReadOnly}
            onChangeText={setName}
            placeholder={t('drillEditor.namePlaceholder')}
            placeholderTextColor={slateGrey}
            style={[styles.input, styles.compactMetadataInput]}
            value={name}
          />
          <TextInput
            accessibilityLabel={t('drillEditor.descriptionLabel')}
            autoCapitalize="sentences"
            editable={!isReadOnly}
            onChangeText={setDescription}
            placeholder={t('drillEditor.descriptionPlaceholder')}
            placeholderTextColor={slateGrey}
            style={[styles.input, styles.compactMetadataInput]}
            value={description}
          />
          {drillId ? (
            <AppButton
              disabled={isPublishing || drillQuery.isLoading}
              icon={isPublished ? 'close-circle-outline' : 'cloud-upload-outline'}
              variant="secondary"
              title={isPublished ? t('drillEditor.unpublishButton') : t('drillEditor.publishButton')}
              onPress={() => void togglePublished()}
            />
          ) : null}
        </View>
      ) : null}
      {drillQuery.isLoading ? (
        <LoadingState />
      ) : null}
      {drillQuery.error ? (
        <Text style={appScreenStyles.error}>{t('drillEditor.loadError')}</Text>
      ) : null}
      {formError ? <Text style={appScreenStyles.error}>{formError}</Text> : null}
      {isReadOnly ? (
        <Text style={appScreenStyles.note}>{t('common.readOnlyNotice')}</Text>
      ) : null}
      {useCompactLayout ? null : (
      <View style={appScreenStyles.card}>
        <Text style={styles.label}>{t('drillEditor.nameLabel')}</Text>
        <TextInput
          autoCapitalize="words"
          editable={!isReadOnly}
          onChangeText={setName}
          placeholder={t('drillEditor.namePlaceholder')}
          placeholderTextColor={slateGrey}
          style={styles.input}
          value={name}
        />
        <Text style={styles.label}>{t('drillEditor.descriptionLabel')}</Text>
        <TextInput
          autoCapitalize="sentences"
          editable={!isReadOnly}
          multiline
          onChangeText={setDescription}
          placeholder={t('drillEditor.descriptionPlaceholder')}
          placeholderTextColor={slateGrey}
          style={[styles.input, styles.descriptionInput]}
          value={description}
        />
      </View>
      )}
      {drillId && !isReadOnly ? (
        useCompactLayout ? null : (
        <View style={styles.publishCard}>
          <View style={styles.publishCopy}>
            <Text style={appScreenStyles.cardTitle}>
              {t('drillEditor.publishTitle')}
            </Text>
            <Text style={appScreenStyles.cardDescription}>
              {isPublished
                ? t('drillEditor.publishedDescription')
                : t('drillEditor.unpublishedDescription')}
            </Text>
          </View>
          <AppButton
            disabled={isPublishing || drillQuery.isLoading}
            icon={isPublished ? 'close-circle-outline' : 'cloud-upload-outline'}
            variant={isPublished ? 'secondary' : 'primary'}
            title={
              isPublishing
                ? t('drillEditor.publishSavingButton')
                : isPublished
                  ? t('drillEditor.unpublishButton')
                  : t('drillEditor.publishButton')
            }
            onPress={() => void togglePublished()}
          />
        </View>
        )
      ) : null}
      <View style={[styles.canvasCard, useCompactLayout && styles.compactCanvasCard]}>
        <GestureDetector gesture={drawGesture}>
          <Pressable
            accessibilityRole="button"
            onLayout={handleCanvasLayout}
            onPress={(event) =>
              handleCanvasPress(
                event.nativeEvent.locationX,
                event.nativeEvent.locationY,
              )
            }
            style={[
              styles.canvas,
              useCompactLayout && {
                alignSelf: 'center',
                aspectRatio: undefined,
                height: compactCanvasHeight,
                width: compactCanvasWidth,
              },
            ]}
          >
            <RinkBackground />
            <PathLayer
              draftPath={draftPath}
              draftZonePoints={draftZonePoints}
              paths={objects.filter(isPathObject)}
              selectedObjectId={selectedObjectId}
              zones={objects.filter(isShadedZoneObject)}
              onInteract={markObjectInteraction}
              onSelect={setSelectedObjectId}
            />
            {objects.filter(isPlacedObject).map((object) => (
              <DrillObjectView
                canvasSize={canvasSize}
                isReadOnly={isReadOnly}
                isSelected={selectedObjectId === object.id}
                key={object.id}
                object={object}
                onEditText={beginTextEdit}
                onInteract={markObjectInteraction}
                onMove={moveObject}
                onSelect={setSelectedObjectId}
              />
            ))}
          </Pressable>
        </GestureDetector>
      </View>
      <View style={styles.selectedBar}>
        <Text style={styles.selectedText}>
          {selectedObject
            ? t('drillEditor.selectedObjectLabel', {
                type: t(`drillEditor.objectTypes.${selectedObject.type}`),
              })
            : t('drillEditor.noSelectionLabel')}
        </Text>
        {isReadOnly ? null : (
          <View style={styles.contextActions}>
            <AppButton
              disabled={undoStack.current.length === 0}
              icon="arrow-undo-outline"
              title={t('drillEditor.undoButton')}
              onPress={undo}
              variant="secondary"
            />
            <AppButton
              disabled={redoStack.current.length === 0}
              icon="arrow-redo-outline"
              title={t('drillEditor.redoButton')}
              onPress={redo}
              variant="secondary"
            />
            {selectedObject ? (
              <>
                <AppButton
                  icon="copy-outline"
                  title={t('drillEditor.duplicateButton')}
                  onPress={duplicateSelectedObject}
                  variant="secondary"
                />
                <AppButton
                  icon="refresh-outline"
                  title={t('drillEditor.rotateButton')}
                  onPress={rotateSelectedObject}
                  variant="secondary"
                />
                <AppButton
                  icon="trash-outline"
                  title={t('drillEditor.deleteButton')}
                  onPress={deleteSelectedObject}
                />
              </>
            ) : null}
          </View>
        )}
      </View>
      {pendingText && !isReadOnly ? (
        <View style={styles.inlineEditor}>
          <Text style={styles.label}>{t('drillEditor.textDraftLabel')}</Text>
          <TextInput
            autoCapitalize="sentences"
            onChangeText={setTextDraft}
            placeholder={t('drillEditor.textDraftPlaceholder')}
            placeholderTextColor={slateGrey}
            style={styles.input}
            value={textDraft}
          />
          <View style={styles.inlineEditorActions}>
            <AppButton
              disabled={!textDraft.trim()}
              icon="checkmark-outline"
              title={t('drillEditor.confirmTextButton')}
              onPress={confirmText}
            />
            <AppButton
              icon="close-outline"
              title={t('common.cancel')}
              onPress={cancelTextEdit}
              variant="secondary"
            />
          </View>
        </View>
      ) : null}
      {selectedTool?.type === 'shaded_zone' && !isReadOnly ? (
        <View style={styles.inlineEditor}>
          <Text style={styles.label}>{t('drillEditor.shadedZoneHint')}</Text>
          <View style={styles.inlineEditorActions}>
            <AppButton
              disabled={draftZonePoints.length < 3}
              icon="checkmark-outline"
              title={t('drillEditor.shadedZoneDoneButton')}
              onPress={finishShadedZone}
            />
            <AppButton
              disabled={draftZonePoints.length === 0}
              icon="refresh-outline"
              title={t('drillEditor.shadedZoneClearButton')}
              onPress={clearShadedZoneDraft}
              variant="secondary"
            />
          </View>
        </View>
      ) : null}
      {selectedObject && !isReadOnly ? (
        <ColorPicker
          selectedColor={selectedObject.color}
          onSelectColor={(color) => {
            if (selectedObject.type === 'player_token') {
              setTokenColor(color);
            }
            updateObjectColor(selectedObject.id, color);
          }}
        />
      ) : null}
      {isReadOnly ? null : (
        <DrillToolbar
          compact={useCompactLayout}
          selectedTool={selectedTool}
          showPlayerChoices={showPlayerChoices}
          showSkateChoices={showSkateChoices}
          showPassChoices={showPassChoices}
          showPuckChoices={showPuckChoices}
          showConeChoices={showConeChoices}
          tokenColor={tokenColor}
          onSelectTokenColor={setTokenColor}
          onSelectTool={(tool) => {
            setSelectedTool(tool);
            setShowPlayerChoices(false);
            setShowSkateChoices(false);
            setShowPassChoices(false);
            setShowPuckChoices(false);
            setShowConeChoices(false);
          }}
          onTogglePlayerChoices={() =>
            setShowPlayerChoices((currentValue) => !currentValue)
          }
          onToggleSkateChoices={() =>
            setShowSkateChoices((currentValue) => !currentValue)
          }
          onTogglePassChoices={() =>
            setShowPassChoices((currentValue) => !currentValue)
          }
          onTogglePuckChoices={() =>
            setShowPuckChoices((currentValue) => !currentValue)
          }
          onToggleConeChoices={() =>
            setShowConeChoices((currentValue) => !currentValue)
          }
        />
      )}
      {isReadOnly ? null : (
        useCompactLayout ? null : (
          <AppButton
            disabled={isSaving || drillQuery.isLoading}
            icon="save-outline"
            title={
              isSaving
                ? t('drillEditor.savingButton')
                : t('drillEditor.saveButton')
            }
            onPress={() => void saveDrill()}
          />
        )
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RinkBackground() {
  return (
    <Svg
      height="100%"
      preserveAspectRatio="none"
      viewBox={`0 0 ${RINK_WIDTH} ${RINK_HEIGHT}`}
      width="100%"
    >
      <Rect
        fill="#f7fbff"
        height={RINK_HEIGHT - 18}
        rx="70"
        stroke="#d5e4ee"
        strokeWidth="10"
        width={RINK_WIDTH - 18}
        x="9"
        y="9"
      />
      <Line stroke="#c63535" strokeWidth="8" x1="500" x2="500" y1="16" y2="484" />
      <Circle cx="500" cy="250" fill="none" r="72" stroke="#b9d0df" strokeWidth="5" />
      <Circle cx="500" cy="250" fill="#c63535" r="8" />
      <Line stroke="#2f68ad" strokeWidth="10" x1="330" x2="330" y1="16" y2="484" />
      <Line stroke="#2f68ad" strokeWidth="10" x1="670" x2="670" y1="16" y2="484" />
      <Line stroke="#c63535" strokeWidth="5" x1="115" x2="115" y1="16" y2="484" />
      <Line stroke="#c63535" strokeWidth="5" x1="885" x2="885" y1="16" y2="484" />
      <Ellipse cx="210" cy="155" fill="none" rx="55" ry="48" stroke="#c63535" strokeWidth="5" />
      <Ellipse cx="210" cy="345" fill="none" rx="55" ry="48" stroke="#c63535" strokeWidth="5" />
      <Ellipse cx="790" cy="155" fill="none" rx="55" ry="48" stroke="#c63535" strokeWidth="5" />
      <Ellipse cx="790" cy="345" fill="none" rx="55" ry="48" stroke="#c63535" strokeWidth="5" />
      <Circle cx="210" cy="155" fill="#c63535" r="6" />
      <Circle cx="210" cy="345" fill="#c63535" r="6" />
      <Circle cx="790" cy="155" fill="#c63535" r="6" />
      <Circle cx="790" cy="345" fill="#c63535" r="6" />
      <Rect fill="none" height="86" rx="14" stroke="#8db0c7" strokeWidth="5" width="54" x="36" y="207" />
      <Rect fill="none" height="86" rx="14" stroke="#8db0c7" strokeWidth="5" width="54" x="910" y="207" />
    </Svg>
  );
}

function PathLayer({
  draftPath,
  draftZonePoints,
  paths,
  selectedObjectId,
  zones,
  onInteract,
  onSelect,
}: {
  draftPath: PathDrillObject | null;
  draftZonePoints: PathPoint[];
  paths: PathDrillObject[];
  selectedObjectId: string | null;
  zones: ShadedZoneObject[];
  onInteract: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <Svg
      height="100%"
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${RINK_WIDTH} ${RINK_HEIGHT}`}
      width="100%"
    >
      {zones.map((zone) => (
        <ZoneShape
          isSelected={selectedObjectId === zone.id}
          key={zone.id}
          onInteract={onInteract}
          onSelect={onSelect}
          zone={zone}
        />
      ))}
      {draftZonePoints.length > 0 ? (
        <>
          {draftZonePoints.length > 1 ? (
            <Path
              d={makePointLineData(draftZonePoints)}
              fill="none"
              stroke={SHADED_ZONE_COLOR}
              strokeDasharray="10 8"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={5}
            />
          ) : null}
          {draftZonePoints.length > 2 ? (
            <Polygon
              fill={SHADED_ZONE_COLOR}
              fillOpacity={0.14}
              points={pointsToPolygonValue(draftZonePoints)}
              stroke={SHADED_ZONE_COLOR}
              strokeDasharray="10 8"
              strokeWidth={4}
            />
          ) : null}
          {draftZonePoints.map((point, index) => (
            <Circle
              cx={point.x}
              cy={point.y}
              fill={iceWhite}
              key={`${point.x}-${point.y}-${index}`}
              r={9}
              stroke={SHADED_ZONE_COLOR}
              strokeWidth={5}
            />
          ))}
        </>
      ) : null}
      {[...paths, ...(draftPath ? [draftPath] : [])].map((pathObject) => (
        <PathShape
          isDraft={pathObject.id === draftPath?.id}
          isSelected={selectedObjectId === pathObject.id}
          key={pathObject.id}
          pathObject={pathObject}
          onInteract={onInteract}
          onSelect={onSelect}
        />
      ))}
    </Svg>
  );
}

function ZoneShape({
  isSelected,
  onInteract,
  onSelect,
  zone,
}: {
  isSelected: boolean;
  onInteract: () => void;
  onSelect: (id: string) => void;
  zone: ShadedZoneObject;
}) {
  const polygonPoints = pointsToPolygonValue(zone.points);

  if (!polygonPoints) {
    return null;
  }

  return (
    <>
      <Polygon
        fill={zone.color}
        fillOpacity={zone.opacity}
        onPress={() => {
          onInteract();
          onSelect(zone.id);
        }}
        points={polygonPoints}
        stroke={zone.color}
        strokeLinejoin="round"
        strokeWidth={3}
      />
      {isSelected ? (
        <Polygon
          fill="none"
          points={polygonPoints}
          stroke={hornAmber}
          strokeLinejoin="round"
          strokeWidth={7}
        />
      ) : null}
    </>
  );
}

function PathShape({
  isDraft,
  isSelected,
  pathObject,
  onInteract,
  onSelect,
}: {
  isDraft: boolean;
  isSelected: boolean;
  pathObject: PathDrillObject;
  onInteract: () => void;
  onSelect: (id: string) => void;
}) {
  const pathData = makePathData(pathObject);
  const arrowData = makeArrowData(getRenderablePathPoints(pathObject));
  const isPass = pathObject.type === 'pass_line';
  const isBackward =
    pathObject.type === 'skate_path' && pathObject.style === 'backward';

  if (!pathData) {
    return null;
  }

  return (
    <>
      <Path
        d={pathData}
        fill="none"
        onPress={() => {
          onInteract();
          onSelect(pathObject.id);
        }}
        opacity={0}
        stroke={pathObject.color}
        strokeWidth={28}
      />
      {isSelected ? (
        <Path
          d={pathData}
          fill="none"
          stroke={hornAmber}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={13}
        />
      ) : null}
      <Path
        d={pathData}
        fill="none"
        opacity={isDraft ? 0.55 : 1}
        stroke={pathObject.color}
        strokeDasharray={isPass ? '18 12' : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={isPass ? 7 : 8}
      />
      {isBackward
        ? makeBackwardTicks(getRenderablePathPoints(pathObject)).map((tick) => (
            <Line
              key={tick.key}
              opacity={isDraft ? 0.55 : 1}
              stroke={pathObject.color}
              strokeLinecap="round"
              strokeWidth={4}
              x1={tick.x1}
              x2={tick.x2}
              y1={tick.y1}
              y2={tick.y2}
            />
          ))
        : null}
      {arrowData ? (
        <Path
          d={arrowData}
          fill={pathObject.color}
          opacity={isDraft ? 0.55 : 1}
        />
      ) : null}
    </>
  );
}

function DrillToolbar({
  compact,
  selectedTool,
  showPlayerChoices,
  showSkateChoices,
  showPassChoices,
  showPuckChoices,
  showConeChoices,
  tokenColor,
  onSelectTokenColor,
  onSelectTool,
  onTogglePlayerChoices,
  onToggleSkateChoices,
  onTogglePassChoices,
  onTogglePuckChoices,
  onToggleConeChoices,
}: {
  compact: boolean;
  selectedTool: ToolChoice | null;
  showPlayerChoices: boolean;
  showSkateChoices: boolean;
  showPassChoices: boolean;
  showPuckChoices: boolean;
  showConeChoices: boolean;
  tokenColor: string;
  onSelectTokenColor: (color: string) => void;
  onSelectTool: (tool: ToolChoice) => void;
  onTogglePlayerChoices: () => void;
  onToggleSkateChoices: () => void;
  onTogglePassChoices: () => void;
  onTogglePuckChoices: () => void;
  onToggleConeChoices: () => void;
}) {
  const { t } = useTranslation();
  const selectedPlayerLabel =
    selectedTool?.type === 'player_token' ? selectedTool.label : null;

  return (
    <View style={[styles.toolbar, compact && styles.compactToolbar]}>
      {showSkateChoices ? (
        <View style={styles.pathChoicePanel}>
          {(['straight', 'curved', 'backward', 'freehand'] as PathStyle[]).map(
            (style) => (
              <Pressable
                accessibilityRole="button"
                key={style}
                onPress={() => onSelectTool({ type: 'skate_path', style })}
                style={styles.pathChoice}
              >
                <Text style={styles.pathChoiceText}>
                  {t(`drillEditor.skateStyles.${style}`)}
                </Text>
              </Pressable>
            ),
          )}
        </View>
      ) : null}
      {showPassChoices ? (
        <View style={styles.pathChoicePanel}>
          {(['straight', 'curved', 'backward', 'freehand'] as PathStyle[]).map(
            (style) => (
              <Pressable
                accessibilityRole="button"
                key={style}
                onPress={() => onSelectTool({ type: 'pass_line', style })}
                style={styles.pathChoice}
              >
                <Text style={styles.pathChoiceText}>
                  {t(`drillEditor.pathStyles.${style}`)}
                </Text>
              </Pressable>
            ),
          )}
        </View>
      ) : null}
      {showPuckChoices ? (
        <VariantChoicePanel
          onSelect={(variant) => onSelectTool({ type: 'puck', variant })}
        />
      ) : null}
      {showConeChoices ? (
        <VariantChoicePanel
          onSelect={(variant) => onSelectTool({ type: 'cone', variant })}
        />
      ) : null}
      {showPlayerChoices ? (
        <View style={styles.playerChoicePanel}>
          <View style={styles.playerChoiceRow}>
            {(['F1', 'F2', 'F3', 'D1', 'D2', 'C', 'G'] as PlayerTokenLabel[]).map((label) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: selectedPlayerLabel === label }}
                key={label}
                onPress={() =>
                  onSelectTool({ color: tokenColor, type: 'player_token', label })
                }
                style={[
                  styles.playerChoice,
                  { backgroundColor: tokenColor },
                  tokenColor === '#ffffff' && styles.lightSwatchBorder,
                  selectedPlayerLabel === label && styles.playerChoiceSelected,
                ]}
              >
                <Text
                  style={[
                    styles.playerChoiceText,
                    tokenColor === '#ffffff' && styles.darkTokenText,
                    selectedPlayerLabel === label &&
                      styles.playerChoiceTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <ColorPicker
            selectedColor={tokenColor}
            onSelectColor={onSelectTokenColor}
          />
        </View>
      ) : null}
      <View style={[styles.toolbarRow, compact && styles.compactToolbarRow]}>
        <ToolButton
          compact={compact}
          icon="player"
          isSelected={selectedTool?.type === 'player_token'}
          label={t('drillEditor.tools.playerToken')}
          onLongPress={onTogglePlayerChoices}
          onPress={onTogglePlayerChoices}
        />
        <ToolButton
          compact={compact}
          icon="skate"
          isSelected={selectedTool?.type === 'skate_path'}
          label={t('drillEditor.tools.skatePath')}
          onLongPress={onToggleSkateChoices}
          onPress={() => onSelectTool({ type: 'skate_path', style: 'curved' })}
        />
        <ToolButton
          compact={compact}
          icon="pass"
          isSelected={selectedTool?.type === 'pass_line'}
          label={t('drillEditor.tools.passLine')}
          onLongPress={onTogglePassChoices}
          onPress={() => onSelectTool({ type: 'pass_line', style: 'straight' })}
        />
        <ToolButton
          compact={compact}
          icon="puck"
          isSelected={selectedTool?.type === 'puck'}
          label={t('drillEditor.tools.puck')}
          onLongPress={onTogglePuckChoices}
          onPress={() => onSelectTool({ type: 'puck', variant: 'single' })}
        />
        <ToolButton
          compact={compact}
          icon="cone"
          isSelected={selectedTool?.type === 'cone'}
          label={t('drillEditor.tools.cone')}
          onLongPress={onToggleConeChoices}
          onPress={() => onSelectTool({ type: 'cone', variant: 'single' })}
        />
        <ToolButton
          compact={compact}
          icon="net"
          isSelected={selectedTool?.type === 'net'}
          label={t('drillEditor.tools.net')}
          onPress={() => onSelectTool({ type: 'net' })}
        />
        <ToolButton
          compact={compact}
          icon="text"
          isSelected={selectedTool?.type === 'text'}
          label={t('drillEditor.tools.textLabel')}
          onPress={() => onSelectTool({ type: 'text' })}
        />
        <ToolButton
          compact={compact}
          icon="zone"
          isSelected={selectedTool?.type === 'shaded_zone'}
          label={t('drillEditor.tools.shadedZone')}
          onPress={() => onSelectTool({ type: 'shaded_zone' })}
        />
      </View>
    </View>
  );
}

function ColorPicker({
  selectedColor,
  onSelectColor,
}: {
  selectedColor: string;
  onSelectColor: (color: string) => void;
}) {
  return (
    <View style={styles.colorPicker}>
      {TOKEN_COLOR_OPTIONS.map((color) => {
        const isSelected = selectedColor === color;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={color}
            onPress={() => onSelectColor(color)}
            style={[
              styles.colorSwatch,
              { backgroundColor: color },
              color === '#ffffff' && styles.lightSwatchBorder,
              isSelected && styles.colorSwatchSelected,
            ]}
          />
        );
      })}
    </View>
  );
}

function VariantChoicePanel({
  onSelect,
}: {
  onSelect: (variant: MarkerVariant) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.pathChoicePanel}>
      {(['single', 'group'] as MarkerVariant[]).map((variant) => (
        <Pressable
          accessibilityRole="button"
          key={variant}
          onPress={() => onSelect(variant)}
          style={styles.pathChoice}
        >
          <Text style={styles.pathChoiceText}>
            {t(`drillEditor.markerVariants.${variant}`)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function ToolButton({
  compact,
  icon,
  isSelected,
  label,
  onLongPress,
  onPress,
}: {
  compact: boolean;
  icon: PracticeToolIconName;
  isSelected: boolean;
  label: string;
  onLongPress?: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onLongPress={onLongPress}
      onPress={onPress}
      style={[
        styles.toolButton,
        compact && styles.compactToolButton,
        isSelected && styles.toolButtonSelected,
      ]}
    >
      <View style={[styles.toolIconBadge, isSelected && styles.toolIconBadgeSelected]}>
        <PracticeToolIcon
          color={isSelected ? iceWhite : colors.textPrimary}
          name={icon}
          size={28}
        />
      </View>
      <Text style={[styles.toolLabel, isSelected && styles.toolLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function DrillObjectView({
  canvasSize,
  isReadOnly,
  isSelected,
  object,
  onEditText,
  onInteract,
  onMove,
  onSelect,
}: {
  canvasSize: CanvasSize;
  isReadOnly: boolean;
  isSelected: boolean;
  object: PlacedDrillObject;
  onEditText: (object: PlacedDrillObject) => void;
  onInteract: () => void;
  onMove: (id: string, nextX: number, nextY: number) => void;
  onSelect: (id: string) => void;
}) {
  if (!isSelected) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          onInteract();
          onSelect(object.id);
          if (object.type === 'text') {
            onEditText(object);
          }
        }}
        style={[
          styles.object,
          {
            left: toScreenX(object.x, canvasSize) - OBJECT_SIZE / 2,
            top: toScreenY(object.y, canvasSize) - OBJECT_SIZE / 2,
            transform: [{ rotate: `${object.rotation}deg` }],
          },
        ]}
      >
        <ObjectShape object={object} />
      </Pressable>
    );
  }

  return (
    <DraggableObjectView
      canvasSize={canvasSize}
      isReadOnly={isReadOnly}
      object={object}
      onEditText={onEditText}
      onInteract={onInteract}
      onMove={onMove}
      onSelect={onSelect}
    />
  );
}

function DraggableObjectView({
  canvasSize,
  isReadOnly,
  object,
  onEditText,
  onInteract,
  onMove,
  onSelect,
}: {
  canvasSize: CanvasSize;
  isReadOnly: boolean;
  object: PlacedDrillObject;
  onEditText: (object: PlacedDrillObject) => void;
  onInteract: () => void;
  onMove: (id: string, nextX: number, nextY: number) => void;
  onSelect: (id: string) => void;
}) {
  const left = useSharedValue(0);
  const top = useSharedValue(0);
  const startLeft = useSharedValue(0);
  const startTop = useSharedValue(0);

  useEffect(() => {
    left.value = toScreenX(object.x, canvasSize) - OBJECT_SIZE / 2;
    top.value = toScreenY(object.y, canvasSize) - OBJECT_SIZE / 2;
  }, [canvasSize, left, object.x, object.y, top]);

  function finishMove(screenX: number, screenY: number) {
    onMove(
      object.id,
      toRinkX(screenX, canvasSize),
      toRinkY(screenY, canvasSize),
    );
  }

  const panGesture = Gesture.Pan()
    .enabled(!isReadOnly)
    .onBegin(() => {
      startLeft.value = left.value;
      startTop.value = top.value;
      runOnJS(onInteract)();
      runOnJS(onSelect)(object.id);
    })
    .onUpdate((event) => {
      left.value = clamp(
        startLeft.value + event.translationX,
        -OBJECT_SIZE / 2,
        Math.max(canvasSize.width - OBJECT_SIZE / 2, -OBJECT_SIZE / 2),
      );
      top.value = clamp(
        startTop.value + event.translationY,
        -OBJECT_SIZE / 2,
        Math.max(canvasSize.height - OBJECT_SIZE / 2, -OBJECT_SIZE / 2),
      );
    })
    .onEnd(() => {
      runOnJS(finishMove)(
        left.value + OBJECT_SIZE / 2,
        top.value + OBJECT_SIZE / 2,
      );
    });
  const tapGesture = Gesture.Tap().onBegin(() => {
    runOnJS(onInteract)();
  }).onEnd(() => {
    runOnJS(onSelect)(object.id);
    if (object.type === 'text') {
      runOnJS(onEditText)(object);
    }
  });
  const composedGesture = Gesture.Simultaneous(tapGesture, panGesture);
  const animatedStyle = useAnimatedStyle(() => ({
    left: left.value,
    top: top.value,
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          styles.object,
          animatedStyle,
          { transform: [{ rotate: `${object.rotation}deg` }] },
          styles.objectSelected,
        ]}
      >
        <ObjectShape object={object} />
      </Animated.View>
    </GestureDetector>
  );
}

function ObjectShape({ object }: { object: PlacedDrillObject }) {
  if (object.type === 'player_token') {
    return (
      <View style={[styles.playerToken, { backgroundColor: object.color }]}>
        <Text style={styles.playerTokenText}>{object.label ?? 'F'}</Text>
      </View>
    );
  }

  if (object.type === 'puck') {
    if (object.variant === 'group') {
      return (
        <View style={styles.puckGroup}>
          <View style={[styles.puck, { backgroundColor: object.color }]} />
          <View style={[styles.puck, { backgroundColor: object.color }]} />
          <View style={[styles.puck, { backgroundColor: object.color }]} />
        </View>
      );
    }

    return <View style={[styles.puck, { backgroundColor: object.color }]} />;
  }

  if (object.type === 'text') {
    return (
      <Text numberOfLines={2} style={[styles.canvasText, { color: object.color }]}>
        {object.text ?? ''}
      </Text>
    );
  }

  if (object.type === 'cone') {
    if (object.variant === 'group') {
      return (
        <View style={styles.coneGroup}>
          <ConeShape color={object.color} />
          <ConeShape color={object.color} />
          <ConeShape color={object.color} />
        </View>
      );
    }

    return <ConeShape color={object.color} />;
  }

  return (
    <Svg height={32} viewBox="0 0 44 34" width={42}>
      <Path
        d="M8 9 L36 9 L40 27 L4 27 Z"
        fill="#ffffff"
        opacity={0.95}
        stroke={object.color}
        strokeLinejoin="round"
        strokeWidth={3}
      />
      <Line stroke="#9db2c1" strokeWidth={1.5} x1="10" x2="34" y1="14" y2="14" />
      <Line stroke="#9db2c1" strokeWidth={1.5} x1="8" x2="36" y1="19" y2="19" />
      <Line stroke="#9db2c1" strokeWidth={1.5} x1="15" x2="11" y1="10" y2="27" />
      <Line stroke="#9db2c1" strokeWidth={1.5} x1="22" x2="22" y1="10" y2="27" />
      <Line stroke="#9db2c1" strokeWidth={1.5} x1="29" x2="33" y1="10" y2="27" />
      <Rect fill={object.color} height={5} rx={2} width={34} x={5} y={6} />
    </Svg>
  );
}

function ConeShape({ color }: { color: string }) {
    return (
      <Svg height={19} viewBox="0 0 24 28" width={17}>
        <Path
          d="M12 3 L19 22 L5 22 Z"
          fill={color}
          stroke="#8a5a0a"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
        <Line stroke="#ffffff" strokeWidth={2} x1={8} x2={16} y1={13} y2={13} />
        <Rect fill="#8a5a0a" height={3} rx={1.5} width={20} x={2} y={22} />
      </Svg>
    );
}

function makeCanvasObject(
  tool: PlaceToolChoice,
  x: number,
  y: number,
): PlacedDrillObject {
  const base = {
    id: `${tool.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    x,
    y,
    rotation: 0,
  };

  if (tool.type === 'player_token') {
    return {
      ...base,
      color: tool.color,
      label: tool.label,
      type: 'player_token',
    };
  }

  if (tool.type === 'puck') {
    return { ...base, color: PUCK_COLOR, type: 'puck', variant: tool.variant };
  }

  if (tool.type === 'cone') {
    return { ...base, color: CONE_COLOR, type: 'cone', variant: tool.variant };
  }

  return { ...base, color: NET_COLOR, type: 'net' };
}

function makePathObject(
  tool: PathToolChoice,
  points: PathPoint[],
): PathDrillObject {
  const base = {
    id: `${tool.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    points,
  };

  if (tool.type === 'skate_path') {
    return {
      ...base,
      color: SKATE_PATH_COLOR,
      style: tool.style,
      type: 'skate_path',
    };
  }

  return {
    ...base,
    color: PASS_LINE_COLOR,
    style: tool.style,
    type: 'pass_line',
  };
}

function normalizeCanvasData(value: unknown): DrillCanvasObject[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, MAX_CANVAS_OBJECTS).flatMap((entry): DrillCanvasObject[] => {
    if (!isCanvasObjectRecord(entry) || !isSupportedObjectType(entry.type)) {
      return [];
    }

    if (entry.type === 'skate_path' || entry.type === 'pass_line') {
      const points = normalizePathPoints(entry.points);

      if (points.length < 2) {
        return [];
      }

      if (entry.type === 'skate_path') {
        return [
          {
            color:
              typeof entry.color === 'string'
                ? entry.color
                : SKATE_PATH_COLOR,
            id:
              typeof entry.id === 'string'
                ? entry.id
                : `${entry.type}-${Math.random().toString(36).slice(2, 8)}`,
            points,
            style: isPathStyle(entry.style) ? entry.style : 'curved',
            type: 'skate_path',
          },
        ];
      }

      return [
        {
          color:
            typeof entry.color === 'string' ? entry.color : PASS_LINE_COLOR,
          id:
            typeof entry.id === 'string'
              ? entry.id
              : `${entry.type}-${Math.random().toString(36).slice(2, 8)}`,
          points,
          style: isPathStyle(entry.style) ? entry.style : 'straight',
          type: 'pass_line',
        },
      ];
    }

    if (entry.type === 'shaded_zone') {
      const points = normalizePathPoints(entry.points);

      if (points.length < 3) {
        return [];
      }

      return [
        {
          color:
            typeof entry.color === 'string' ? entry.color : SHADED_ZONE_COLOR,
          id:
            typeof entry.id === 'string'
              ? entry.id
              : `${entry.type}-${Math.random().toString(36).slice(2, 8)}`,
          opacity:
            typeof entry.opacity === 'number'
              ? clamp(entry.opacity, 0.05, 0.8)
              : SHADED_ZONE_OPACITY,
          points,
          type: 'shaded_zone',
        },
      ];
    }

    const x = typeof entry.x === 'number' ? entry.x : Number(entry.x);
    const y = typeof entry.y === 'number' ? entry.y : Number(entry.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return [];
    }

    return [
      {
        color: typeof entry.color === 'string' ? entry.color : fallbackColor(entry.type),
        id:
          typeof entry.id === 'string'
            ? entry.id
            : `${entry.type}-${Math.random().toString(36).slice(2, 8)}`,
        label: isPlayerTokenLabel(entry.label) ? entry.label : undefined,
        rotation:
          typeof entry.rotation === 'number' && Number.isFinite(entry.rotation)
            ? entry.rotation % 360
            : 0,
        text: typeof entry.text === 'string' ? entry.text : undefined,
        type: entry.type,
        variant: isMarkerVariant(entry.variant) ? entry.variant : 'single',
        x: clamp(x, 0, RINK_WIDTH),
        y: clamp(y, 0, RINK_HEIGHT),
      },
    ];
  });
}

function normalizePathPoints(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, MAX_PATH_POINTS).flatMap((entry): PathPoint[] => {
    if (!isCanvasObjectRecord(entry)) {
      return [];
    }

    const x = typeof entry.x === 'number' ? entry.x : Number(entry.x);
    const y = typeof entry.y === 'number' ? entry.y : Number(entry.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return [];
    }

    return [
      {
        x: clamp(x, 0, RINK_WIDTH),
        y: clamp(y, 0, RINK_HEIGHT),
      },
    ];
  });
}

function isCanvasObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSupportedObjectType(value: unknown): value is DrillObjectType {
  return (
    value === 'player_token' ||
    value === 'puck' ||
    value === 'cone' ||
    value === 'net' ||
    value === 'text' ||
    value === 'skate_path' ||
    value === 'pass_line' ||
    value === 'shaded_zone'
  );
}

function isPlaceTool(tool: ToolChoice): tool is PlaceToolChoice {
  return (
    tool.type === 'player_token' ||
    tool.type === 'puck' ||
    tool.type === 'cone' ||
    tool.type === 'net'
  );
}

function isPathTool(tool: ToolChoice): tool is PathToolChoice {
  return tool.type === 'skate_path' || tool.type === 'pass_line';
}

function isPlacedObject(object: DrillCanvasObject): object is PlacedDrillObject {
  return (
    object.type === 'player_token' ||
    object.type === 'puck' ||
    object.type === 'cone' ||
    object.type === 'net' ||
    object.type === 'text'
  );
}

function isPathObject(object: DrillCanvasObject): object is PathDrillObject {
  return object.type === 'skate_path' || object.type === 'pass_line';
}

function isShadedZoneObject(
  object: DrillCanvasObject,
): object is ShadedZoneObject {
  return object.type === 'shaded_zone';
}

function isPathStyle(value: unknown): value is PathStyle {
  return (
    value === 'straight' ||
    value === 'curved' ||
    value === 'backward' ||
    value === 'freehand'
  );
}

function isPlayerTokenLabel(value: unknown): value is PlayerTokenLabel {
  return ['F', 'F1', 'F2', 'F3', 'D', 'D1', 'D2', 'G', 'C'].includes(
    String(value),
  );
}

function isMarkerVariant(value: unknown): value is MarkerVariant {
  return value === 'single' || value === 'group';
}

function fallbackColor(type: DrillObjectType) {
  if (type === 'player_token') {
    return PLAYER_TOKEN_COLOR;
  }

  if (type === 'puck') {
    return PUCK_COLOR;
  }

  if (type === 'cone') {
    return CONE_COLOR;
  }

  if (type === 'text') {
    return TEXT_COLOR;
  }

  if (type === 'shaded_zone') {
    return SHADED_ZONE_COLOR;
  }

  if (type === 'skate_path') {
    return SKATE_PATH_COLOR;
  }

  if (type === 'pass_line') {
    return PASS_LINE_COLOR;
  }

  return NET_COLOR;
}

function pointsToPolygonValue(points: PathPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function makePointLineData(points: PathPoint[]) {
  const firstPoint = points[0];

  if (!firstPoint) {
    return '';
  }

  return points
    .slice(1)
    .reduce(
      (pathData, point) => `${pathData} L ${point.x} ${point.y}`,
      `M ${firstPoint.x} ${firstPoint.y}`,
    );
}

function getRenderablePathPoints(pathObject: PathDrillObject) {
  if (pathObject.style === 'straight') {
    const firstPoint = pathObject.points[0];
    const lastPoint = pathObject.points[pathObject.points.length - 1];

    return firstPoint && lastPoint ? [firstPoint, lastPoint] : [];
  }

  return pathObject.points;
}

function makePathData(pathObject: PathDrillObject) {
  const points = getRenderablePathPoints(pathObject);

  if (points.length < 2) {
    return '';
  }

  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  if (pathObject.style === 'freehand') {
    return makePointLineData(points);
  }

  let pathData = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const currentPoint = points[index];
    const nextPoint = points[index + 1];
    const midPoint = getMidPoint(currentPoint, nextPoint);
    pathData += ` Q ${currentPoint.x} ${currentPoint.y} ${midPoint.x} ${midPoint.y}`;
  }

  const lastPoint = points[points.length - 1];
  pathData += ` L ${lastPoint.x} ${lastPoint.y}`;

  return pathData;
}

function makeArrowData(points: PathPoint[]) {
  if (points.length < 2) {
    return '';
  }

  const endPoint = points[points.length - 1];
  let startPoint = points[points.length - 2];

  for (let index = points.length - 2; index >= 0; index -= 1) {
    if (getPointDistance(points[index], endPoint) > 4) {
      startPoint = points[index];
      break;
    }
  }

  const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
  const arrowLength = 22;
  const arrowWidth = 14;
  const baseX = endPoint.x - Math.cos(angle) * arrowLength;
  const baseY = endPoint.y - Math.sin(angle) * arrowLength;
  const perpendicularX = Math.cos(angle + Math.PI / 2) * arrowWidth * 0.5;
  const perpendicularY = Math.sin(angle + Math.PI / 2) * arrowWidth * 0.5;

  return [
    `M ${endPoint.x} ${endPoint.y}`,
    `L ${baseX + perpendicularX} ${baseY + perpendicularY}`,
    `L ${baseX - perpendicularX} ${baseY - perpendicularY}`,
    'Z',
  ].join(' ');
}

function makeBackwardTicks(points: PathPoint[]) {
  const ticks: Array<{
    key: string;
    x1: number;
    x2: number;
    y1: number;
    y2: number;
  }> = [];

  for (let index = 1; index < points.length; index += 2) {
    const previousPoint = points[index - 1];
    const currentPoint = points[index];
    const distance = getPointDistance(previousPoint, currentPoint);

    if (distance < 1) {
      continue;
    }

    const midPoint = getMidPoint(previousPoint, currentPoint);
    const normalX = -((currentPoint.y - previousPoint.y) / distance);
    const normalY = (currentPoint.x - previousPoint.x) / distance;
    const halfTick = 9;

    ticks.push({
      key: `${index}-${midPoint.x}-${midPoint.y}`,
      x1: midPoint.x - normalX * halfTick,
      x2: midPoint.x + normalX * halfTick,
      y1: midPoint.y - normalY * halfTick,
      y2: midPoint.y + normalY * halfTick,
    });
  }

  return ticks;
}

function simplifyPathPoints(pathObject: PathDrillObject) {
  const points =
    pathObject.style === 'straight'
      ? getRenderablePathPoints(pathObject)
      : pathObject.points;

  if (points.length <= 2) {
    return points;
  }

  return points.filter((point, index) => {
    if (index === 0 || index === points.length - 1) {
      return true;
    }

    const previousPoint = points[index - 1];
    return getPointDistance(previousPoint, point) >= MIN_PATH_POINT_DISTANCE;
  });
}

function duplicateCanvasObject(object: DrillCanvasObject): DrillCanvasObject {
  const id = `${object.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (isPlacedObject(object)) {
    return {
      ...object,
      id,
      x: clamp(object.x + 35, 0, RINK_WIDTH),
      y: clamp(object.y + 35, 0, RINK_HEIGHT),
    };
  }

  return {
    ...object,
    id,
    points: object.points.map((point) => ({
      x: clamp(point.x + 25, 0, RINK_WIDTH),
      y: clamp(point.y + 25, 0, RINK_HEIGHT),
    })),
  };
}

function rotateCanvasObject(
  object: DrillCanvasObject,
  degrees: number,
): DrillCanvasObject {
  if (isPlacedObject(object)) {
    return {
      ...object,
      rotation: (object.rotation + degrees) % 360,
    };
  }

  const center = object.points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  center.x /= object.points.length;
  center.y /= object.points.length;
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);

  return {
    ...object,
    points: object.points.map((point) => {
      const x = point.x - center.x;
      const y = point.y - center.y;
      return {
        x: clamp(center.x + x * cosine - y * sine, 0, RINK_WIDTH),
        y: clamp(center.y + x * sine + y * cosine, 0, RINK_HEIGHT),
      };
    }),
  };
}

function getMidPoint(firstPoint: PathPoint, secondPoint: PathPoint) {
  return {
    x: (firstPoint.x + secondPoint.x) / 2,
    y: (firstPoint.y + secondPoint.y) / 2,
  };
}

function getPointDistance(firstPoint: PathPoint, secondPoint: PathPoint) {
  return Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y);
}

function toRinkPoint(x: number, y: number, canvasSize: CanvasSize) {
  return {
    x: clamp(toRinkX(x, canvasSize), 0, RINK_WIDTH),
    y: clamp(toRinkY(y, canvasSize), 0, RINK_HEIGHT),
  };
}

function toScreenX(x: number, canvasSize: CanvasSize) {
  return canvasSize.width > 0 ? (x / RINK_WIDTH) * canvasSize.width : 0;
}

function toScreenY(y: number, canvasSize: CanvasSize) {
  return canvasSize.height > 0 ? (y / RINK_HEIGHT) * canvasSize.height : 0;
}

function toRinkX(x: number, canvasSize: CanvasSize) {
  return canvasSize.width > 0 ? (x / canvasSize.width) * RINK_WIDTH : 0;
}

function toRinkY(y: number, canvasSize: CanvasSize) {
  return canvasSize.height > 0 ? (y / canvasSize.height) * RINK_HEIGHT : 0;
}

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

const styles = StyleSheet.create({
  canvas: {
    aspectRatio: 2,
    backgroundColor: iceWhite,
    borderRadius: radii.md,
    overflow: 'hidden',
    width: '100%',
  },
  canvasCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.control,
  },
  compactMetadata: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  compactMetadataInput: {
    flex: 1,
    minWidth: 180,
    paddingVertical: spacing.control,
  },
  coneGroup: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 1,
  },
  contextActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'flex-end',
  },
  colorPicker: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.control,
  },
  colorSwatch: {
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: spacing.page,
    width: spacing.page,
  },
  colorSwatchSelected: {
    borderColor: goalRed,
    borderWidth: 3,
  },
  content: {
    flexGrow: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  input: {
    backgroundColor: colors.fieldBackground,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    padding: spacing.md,
  },
  inlineEditor: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.control,
    padding: spacing.md,
  },
  inlineEditorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: '800',
  },
  darkTokenText: {
    color: rinkNavy,
  },
  description: {
    color: colors.frostSteel,
    fontSize: fontSizes.base,
    lineHeight: lineHeights.drillDescription,
  },
  descriptionInput: {
    minHeight: sizes.multiline,
    textAlignVertical: 'top',
  },
  eyebrow: {
    color: colors.hornAmber,
    fontSize: fontSizes.xs,
    fontWeight: '700',
    letterSpacing: 2,
  },
  header: {
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  compactCanvasCard: {
    borderLeftWidth: 0,
    borderRadius: 0,
    borderRightWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: spacing.lineGap,
  },
  compactContent: {
    gap: spacing.sm,
    paddingHorizontal: 0,
    paddingTop: spacing.sm,
  },
  compactHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  compactToolbar: {
    borderLeftWidth: 0,
    borderRadius: 0,
    borderRightWidth: 0,
    gap: spacing.xs,
    padding: spacing.xs,
  },
  compactToolbarRow: {
    justifyContent: 'center',
  },
  compactToolButton: {
    minHeight: 54,
    minWidth: 64,
    padding: spacing.xs,
  },
  object: {
    alignItems: 'center',
    height: OBJECT_SIZE,
    justifyContent: 'center',
    position: 'absolute',
    width: OBJECT_SIZE,
  },
  objectSelected: {
    backgroundColor: '#f2aa2e40',
    borderColor: hornAmber,
    borderRadius: radii.pill,
    borderWidth: 2,
  },
  playerChoice: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: sizes.playerChoice,
    justifyContent: 'center',
    width: sizes.playerChoice,
  },
  playerChoiceSelected: {
    borderColor: goalRed,
    borderWidth: 3,
    shadowColor: goalRed,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  playerChoiceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  playerChoicePanel: {
    gap: spacing.control,
  },
  pathChoice: {
    backgroundColor: colors.cardPressed,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: sizes.pathChoiceVertical,
  },
  pathChoicePanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  pathChoiceText: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: '800',
  },
  canvasText: {
    backgroundColor: '#ffffffcc',
    borderRadius: radii.sm,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    maxWidth: sizes.canvasTextMaxWidth,
    minWidth: sizes.iconButton,
    paddingHorizontal: spacing.formGap,
    paddingVertical: spacing.tight,
    textAlign: 'center',
  },
  playerChoiceText: {
    color: '#ffffff',
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    fontWeight: '900',
  },
  playerChoiceTextSelected: {
    textDecorationLine: 'underline',
  },
  lightSwatchBorder: {
    borderColor: rinkNavy,
  },
  playerToken: {
    alignItems: 'center',
    borderColor: rinkNavy,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: spacing.page,
    justifyContent: 'center',
    width: spacing.page,
  },
  playerTokenText: {
    color: '#ffffff',
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    fontWeight: '900',
  },
  puck: {
    borderColor: '#000000',
    borderRadius: radii.pill,
    borderWidth: 1.5,
    height: sizes.sm,
    width: sizes.sm,
  },
  puckGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  publishCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  publishCopy: {
    flex: 1,
    flexShrink: 1,
    gap: spacing.xs,
  },
  selectedBar: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    padding: spacing.md,
  },
  screen: {
    backgroundColor: colors.rinkNavy,
    flex: 1,
  },
  selectedText: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  toolbar: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.control,
    padding: spacing.control,
  },
  toolbarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  toolButton: {
    alignItems: 'center',
    backgroundColor: colors.fieldBackground,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.tight,
    minHeight: sizes.toolMinHeight,
    minWidth: sizes.toolMinWidth,
    justifyContent: 'center',
    padding: spacing.lineGap,
  },
  toolButtonSelected: {
    backgroundColor: colors.dangerSoft,
    borderColor: goalRed,
    shadowColor: goalRed,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  toolIconBadge: {
    alignItems: 'center',
    backgroundColor: colors.cardPressed,
    borderRadius: radii.md,
    height: 38,
    justifyContent: 'center',
    width: 42,
  },
  toolIconBadgeSelected: {
    backgroundColor: goalRed,
  },
  toolLabel: {
    color: slateGrey,
    fontSize: fontSizes.tiny,
    fontWeight: '700',
    textAlign: 'center',
  },
  toolLabelSelected: {
    color: goalRed,
  },
  title: {
    color: colors.textOnDark,
    fontFamily: fonts.display,
    fontSize: fontSizes.title,
    fontWeight: '700',
  },
});
